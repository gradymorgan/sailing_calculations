(function (global, factory) {
    if (typeof exports === 'object' && typeof module !== 'undefined') {
        factory(exports, require('lodash'), require('./calcs.js'));
    }
    else {
        factory((global.homegrown.utilities = {}), global._, global.homegrown.calculations);
    }
}(this, function (exports, _, calcs) {'use strict';

    //from stack overflow
    var remove_comments_regex = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
    var argument_names_regex = /([^\s,]+)/g;
    function getParamNames(funct) {
      var fnStr = funct.toString().replace(remove_comments_regex, '');
      var result = fnStr.slice(fnStr.indexOf('(')+1, fnStr.indexOf(')')).match(argument_names_regex);
      if ( result === null )
         result = [];
      return result;
    }

    var utilities = {
        /**
         * given a metric, will compute it's derivitive and append incoming data points
         *          with new metric.
         * @param name - the name of the new metric created from the derivitive
         * @param metric - the name of the metric to calculate the derivitive from
         * @param [scaleFactor] - optional conversion factor, if the new metric should
         *                        be in different units.
         * @return 
         */
        derivative: function derivative(name, metric, scaleFactor) {
            scaleFactor = scaleFactor || 1;
            var lastValue = null, lastTime;

            return function(point) {
                if (metric in point) {
                    if (lastValue !== null) {
                        var delta = (point[metric] - lastValue) / ((point.t - lastTime)/1000) * scaleFactor;

                        point[name] = delta;
                    }

                    lastValue = point[metric];
                    lastTime = point.t;
                }
            };
        },
        /**
         * will average a metric with a trailing window, and append the new value to the 
         *          incoming point.
         * @param name - the name of the new metric created from the average
         * @param 
         * 
         */
        average: function average(name, metric, windowSize) {
            var rolling = 0;
            var counter = 0;
            var windowX = [];

            return function(point) {
                if (metric in point) {
                    var pos = counter % windowSize;
                    counter++;

                    if (windowX[pos]) {
                        rolling -= windowX[pos];
                    }
                    rolling += point[metric];
                    windowX[pos] = point[metric];

                    point[name] = rolling / windowX.length;
                }
            };
        },

        inlineUpdate: function inlineUpdate(funct, property) {
            return function(point) {
                if ( property in point ) {
                    point[property] = funct(point[property]);
                }
            };
        },

        /**
         * Adjust Awa based on Heel angle.
         */
        inlineAwaAdjustment: function inlineAwaAdjustment() {
            var lastHeel = 0;

            return function(point) {
                if ( 'heel' in point ) {
                    lastHeel = point.heel;
                }
                if ( 'awa' in point ) {
                    point.awa = calcs.adjustAwaForHeel(point.awa, lastHeel);
                }
            };
        },

        /**
         * Wraps function to allow it to handle streaming inputs.  
         * @param funct - the name of the function will be used to name the return value.  
         *                The name of the arguments will be used to pull the arguments out 
         *                of maps of possible arguments.
         */
        delayedInputs: function delayedInputs(funct, output, argumentNames) {
            argumentNames = argumentNames || getParamNames(funct);
            output = output || funct.name;

            var runningArgs = [];

            return function(point) {
                var allSet = true;
                for( var i=0; i < argumentNames.length; i++ ) {
                    if ( argumentNames[i] in point ) {
                        runningArgs[i] = point[argumentNames[i]];
                    }

                    if ( !runningArgs[i] ) {
                        allSet = false;
                    }
                }

                //if all 
                if (allSet) {
                    var result = funct.apply(this, runningArgs);
                    runningArgs = [];
                    
                    point[output] = result;
                }
            };
        },

        /*
            Pass in a data array, where each element has a time, t and a set of segments,
            each with a start and end time, and get back a new segment array, with each having
            a data array for points within the segments start and end time.
        */
        segmentData: function segmentData(data, segments) {
            var segs = _.clone(segments, true);
            _.each(segs, function(seg) {
                seg.data = [];
            });

            var j = 0;
            for ( var i=0; i < data.length; i++ ) {
                if ( data[i].t < segs[j].start ) {
                    continue;
                }
                else if ( data[i].t < segs[j].end ) {
                    segs[j].data.push(data[i]);
                }
                else {
                    j++;
                    if (j >= segs.length) 
                        break;
                    segs[j].data.push(data[i]);
                }
            }

            return segs;
        },

        //untested: create a new segment whenever 
        createChangeDataSegments: function createSegments(data, field) {
            
            var segments = [];
            var lastValue = null;
            var startTime = null;

            //get points from data
            var getValue, fieldName;
            if (typeof field == 'function') {
                getValue = field;
                fieldName = field.name;
            }
            else {
                getValue = function getValue(point) {
                    if (field in point)
                        return point[field];
                    else 
                        return null;
                };
                fieldName = field;
            }

            var i=0;
            for (; i < data.length; i++) {
                var value = getValue(data[i]);
                if ( value ) {
                    lastValue = value;
                    startTime = data[i].t;
                    break;
                }
            }
            
            for (; i < data.length; i++) {
                var newValue = getValue(data[i]);

                if ( newValue && newValue != lastValue ) {
                    var seg = {
                        // value: lastValue,
                        start: startTime,
                        end: data[i].t
                    };
                    seg[fieldName] = lastValue;
                    segments.push(seg);

                    lastValue = newValue;
                    startTime = data[i].t;
                }
            }

            return segments;
        },

        createSummaryDataSegments: function summerizeData(data, field, timeStep) {
            timeStep = timeStep || 10000; //default 10 seconds

            var segments = [];
            var sum=0, count=0;
            var startTime = data[0].t;
            
            for (var i=0; i < data.length; i++) {
                if (data[i].t > startTime + timeStep) {
                    var seg = {
                        start: startTime,
                        end: data[i].t
                    };
                    seg[field] = sum/count;
                    segments.push(seg);

                    sum = 0; count = 0;
                    startTime = data[i].t;
                }

                if ( field in data[i] ) {
                    sum += data[i][field];
                    count++;
                }
            }

            return segments;
        }, 

        /**
         * Calulate the circular mean of an array of angles
         * 
         */
        circularMean: function circularMean(dat) {
            var sinComp = 0, cosComp = 0;
            _.each(dat, function(angle) {
                sinComp += Math.sin(rad(angle));
                cosComp += Math.cos(rad(angle));
            });

            return (360+deg(Math.atan2(sinComp/dat.length, cosComp/dat.length)))%360;
        }
    };

    _.extend(exports, utilities);
}));