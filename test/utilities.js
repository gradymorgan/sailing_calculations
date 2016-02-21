var assert = require('chai').assert;
var utilities = require('../src/utilities.js');

describe('derivative', function() {
    it('should work', function() {
        console.info(utilities, utilities.derivative);

        var acceleration = utilities.derivative('acceleration', 'speed');

        var point = {'speed': 5, 't':1000};
        acceleration(point); 
        assert.deepEqual(point, {'speed': 5, 't':1000});

        point = {'speed': 5, 't':2000};
        acceleration(point);
        assert.deepEqual(point, {'speed': 5, 't':2000, 'acceleration': 0});
        
        point = {'speed': 6, 't':3000};
        acceleration(point);
        assert.deepEqual(point, {'speed': 6, 't':3000, 'acceleration': 1});
    });
});