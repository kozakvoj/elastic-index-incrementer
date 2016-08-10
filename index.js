(function () {
    'use strict';

    const elasticIndexIncementer = {};

    var _       = require('lodash'),
        async   = require('async'),
        winston = require('winston'),
        logger  = new winston.Logger({
            level     : 'debug',
            transports: [new (winston.transports.Console)()]
        });

    elasticIndexIncementer.init = client => {
        const bindedElasticIndexIncementer = {};
        Object.keys(elasticIndexIncementer).forEach(key => {
            bindedElasticIndexIncementer[key] = elasticIndexIncementer[key].bind(null, client);
        });

        return bindedElasticIndexIncementer;
    };

    elasticIndexIncementer.createNewIndex = (client, alias, mapping, callback) => {
        async.autoInject({
            alias        : callback => callback(null, alias),
            indexOld     : callback => getIndexName(client, alias, callback),
            indexNew     : (indexOld, callback) => callback(null, incrementIndex(indexOld)),
            uploadMapping: (indexNew, callback) => uploadMapping(client, indexNew, mapping, callback),
            addAlias     : (indexNew, uploadMapping, callback) => createAliasForNewIndex(client, indexNew, alias, callback)
        }, callback);
    };

    elasticIndexIncementer.switchAlias = (client, indexInfo, callback) => {
        if (getVersionFromIndexName(indexInfo.indexOld, indexInfo.alias) !== 0) {
            async.series({
                removeAlias: (callback, results) => updateAlias(client, 'remove', indexInfo.indexOld, indexInfo.alias, callback),
                addAlias   : (callback, results) => updateAlias(client, 'add', indexInfo.indexNew, indexInfo.alias, callback),
            }, callback);
        }
    };

    elasticIndexIncementer.removeOldIndex = (client, indexOld, callback) => {
        if (getVersionFromIndexName(indexOld) !== 0) {
            logger.debug("removing old search index");
            client.indices.delete({index: indexOld}, callback);
        }
    };

    function createAliasForNewIndex(client, indexNew, alias, callback) {
        return (getVersionFromIndexName(indexNew) === 1) ?
            updateAlias(client, 'add', indexNew, alias, callback) :
            callback();
    }

    function getIndexName(client, alias, callback) {
        getInfoAboutIndex(client, alias, (err, resp) => {
            return (err && err.status === 404) ?
                callback(null, `${alias}_v0`) :
                callback(null, _.findKey(resp, 'aliases'));
        });
    }

    function getInfoAboutIndex(client, alias, callback) {
        client.indices.get({index: alias}, callback);
    }

    function incrementIndex(indexName) {
        let version = getVersionFromIndexName(indexName) + 1;
        let newIndexName = `${getAliasFromIndexName(indexName)}_v${version}`;

        logger.info(`new index name: ${newIndexName}`);
        return newIndexName;
    }

    function getVersionFromIndexName(indexName) {
        return Number(indexName.substr(indexName.indexOf("_") + 2, indexName.length));
    }

    function getAliasFromIndexName(indexName) {
        return indexName.substr(0, indexName.indexOf("_"));
    }

    function uploadMapping(client, indexName, mapping, callback) {
        logger.debug("setting up new index with appropriate mapping");
        client.indices.create({index: indexName, body: mapping}, callback);
    }

    function updateAlias(client, action, index, alias, callback) {
        logger.debug(`${action} alias [index: ${index}, alias: ${alias}]`);
        client.indices.updateAliases({
            body: {actions: [{[action]: {"index": index, "alias": alias}}]}
        }, (err, response, body) => callback(err, body));
    }

    module.exports = elasticIndexIncementer;
})();