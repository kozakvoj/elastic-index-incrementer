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
            indexOld     : callback => getRealElasticName(client, alias, callback),
            indexNew     : (indexOld, callback) => callback(null, incrementGeoIndex(indexOld)),
            uploadMapping: (indexNew, callback) => uploadMapping(client, indexNew, mapping, callback),
        }, (err, results) => callback(err, results));
    };

    elasticIndexIncementer.switchAlias = (client, indexInfo, callback) => {
        async.series({
            removeAlias: (callback, results) => updateAlias(client, 'remove', indexInfo.indexOld, indexInfo.alias, callback),
            addAlias   : (callback, results) => updateAlias(client, 'add', indexInfo.indexNew, indexInfo.alias, callback),
        }, (err, resp) => callback(err, resp));
    };

    elasticIndexIncementer.removeOldIndex = (client, indexOld, callback) => {
        logger.debug("removing old search index");
        client.indices.delete({index: indexOld}, (err, resp) => callback(err, resp));
    };

    function getRealElasticName(client, alias, callback) {
        getInfoAboutIndex(client, alias, (err, resp) => {
            let realName = _.findKey(resp, 'aliases');
            logger.debug(`alias ${alias} realname: ${realName}`);
            callback(err, realName);
        });
    }

    function getInfoAboutIndex(client, alias, callback) {
        client.indices.get({index: alias}, (err, resp) => callback(err, resp));
    }

    function incrementGeoIndex(geoIndexOld) {
        if (!geoIndexOld) {
            logger.info("new geo index name: geo_v1");
            return "geo_v1";
        }

        let version = Number(geoIndexOld.substr(geoIndexOld.length - 1, geoIndexOld.length)) + 1;
        let newGeoIndexName = geoIndexOld.slice(0, -1) + version;

        logger.info(`new geo index name: ${newGeoIndexName}`);
        return newGeoIndexName;
    }

    function uploadMapping(client, geoIndex, mapping, callback) {
        logger.debug("setting up new geo index with appropriate mapping");
        client.indices.create({index : geoIndex, body: mapping}, () => callback());
    }

    function updateAlias(client, action, index, alias, callback) {
        logger.debug(`${action} alias [index: ${index}, alias: ${alias}]`);
        client.indices.updateAliases({
            body: {actions: [{[action]: {"index": index, "alias": alias}}]}
        }, (err, response, body) => callback(err, body));
    }

    module.exports = elasticIndexIncementer;
})();