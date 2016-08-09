# elastic-index-incrementer

## API

### createNewIndex([client], indexName, mapping, callback)
The first run of this method (with empty database) will create a new index with an index name indexName_v1. An alias indexName will also be created.
Every subsequent run will create an index with incremented version (indexName_v2, ...). There will be no changes with aliases.

### switchAlias([client], indexInfoObj, callback)
indexInfoObj must be an object:
```javascript
{
    alias    : aliss
    indexOld : indexOld
    indexNew : indexNew
}
```

Compliant object is also returned as data from createNewIndex function.
This function will create an alias to indexNew and will remove it from indexOld.

### removeOldIndex([client], indexName, callback)
This removes any index specified. This is meant to be the old index after swapping aliases.

## Optional Init
Each function of elastic-index-incrementer requires elastic client to be passed as a first argument. In order to avoid passing elastic client each time, you can run init function and provide elastic client once for all. The returned value is a new elastic-index-incrementer with all functions binded.

```javascript
var esIncrementer = require('elastic-index-incrementer').init(client);
```

## Usage example
**Binded methods**
```javascript
esIncrementer.createNewIndex("indexName", require("./esMapping.json"), (err, indexInfo) => {
    esIncrementer.switchAlias(indexInfo, () => {
        esIncrementer.removeOldIndex(indexInfo.indexOld, () => {

        });
    });
});
```

**Unbinded methods**
```javascript
esIncrementer.createNewIndex(client, "indexName", require("./esMapping.json"), (err, indexInfo) => {
    esIncrementer.switchAlias(client, indexInfo, () => {
        esIncrementer.removeOldIndex(client, indexInfo.indexOld, () => {

        });
    });
});
```