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
        }, (err, results) => callback(err, results));
    };

    elasticIndexIncementer.switchAlias = (client, indexInfo, callback) => {
        if (getVersionFromIndexName(indexInfo.indexOld) !== 0) {
            async.series({
                removeAlias: (callback, results) => updateAlias(client, 'remove', indexInfo.indexOld, indexInfo.alias, callback),
                addAlias   : (callback, results) => updateAlias(client, 'add', indexInfo.indexNew, indexInfo.alias, callback),
            }, (err, resp) => callback(err, resp));
        }
    };

    elasticIndexIncementer.removeOldIndex = (client, indexOld, callback) => {
        if (getVersionFromIndexName(indexOld) !== 0) {
            logger.debug("removing old search index");
            client.indices.delete({index: indexOld}, (err, resp) => callback(err, resp));
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
        client.indices.get({index: alias}, (err, resp) => callback(err, resp));
    }

    function incrementIndex(indexOld) {
        let version = getVersionFromIndexName(indexOld) + 1;
        let newIndexName = `${getIndexNameWithoutVersion(indexOld)}_v${version}`;

        logger.info(`new index name: ${newIndexName}`);
        return newIndexName;
    }

    function getVersionFromIndexName(indexName) {
        return Number(indexName.substr(indexName.length - 1, indexName.length));
    }

    function getIndexNameWithoutVersion(index) {
        return index.slice(0, -3);
    }

    function uploadMapping(client, indexName, mapping, callback) {
        logger.debug("setting up new index with appropriate mapping");
        client.indices.create({index: indexName, body: mapping}, () => callback());
    }

    function updateAlias(client, action, index, alias, callback) {
        logger.debug(`${action} alias [index: ${index}, alias: ${alias}]`);
        client.indices.updateAliases({
            body: {actions: [{[action]: {"index": index, "alias": alias}}]}
        }, (err, response, body) => callback(err, body));
    }

    module.exports = elasticIndexIncementer;
})();