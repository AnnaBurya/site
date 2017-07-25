var async = require('async');
var util = require('util');

var mongoose = require('lib/mongoose'),
    Schema = mongoose.Schema;

var schema = new Schema({
    username: {
        _id: 5,
        unique: false,
        type: String,
        required: true
    },
    theme: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    created: {
        type: Date
    }
});

exports.Record = mongoose.model('Record', schema);



