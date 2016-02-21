(function (global, factory) {
    if (typeof exports === 'object' && typeof module !== 'undefined') {
        factory(exports, require('lodash'));
    }
    else {
        factory((global.homegrown.calculations = {}), global._);
    }
}(this, function (exports, _) { 'use strict';

    var R = 3440.06479; //radius of earth in nautical miles

    var deg = function deg(radians) {
        return calcs.normalizeHeading(radians*180/Math.PI, 360);
    };

    var rad = function rad(degrees) {
        return degrees * Math.PI / 180;
    };

    var lawOfCosines = function(a, b, gamma) {
        return Math.sqrt(a * a + b * b - 2 * b * a * Math.cos(rad(Math.abs(gamma))));
    };

    var calcs = {
        tws: function tws(speed, awa, aws) {
            //TODO: heel compensation
            return lawOfCosines(speed, aws, awa);
        },

        twa: function twa(speed, awa, tws) {
            var angle = deg(Math.asin(speed * Math.sin(rad(Math.abs(awa))) / tws)) + Math.abs(awa);
            if (awa < 0) angle *= -1;
            return angle;
        },

        gws: function gws(sog, awa, aws) {
            return lawOfCosines(sog, aws, awa);
        },

        gwd: function gwd(sog, cog, awa, gws) {
            var gwa = calcs.twa(sog, awa, gws);
            return calcs.normalizeHeading(cog + gwa, 360);
        },

        vmg: function vmg(speed, twa) {
            return Math.abs(speed * Math.cos(rad(twa)));
        },

        twd: function twd(hdg, twa) {
            return calcs.normalizeHeading(hdg + twa, 360);
        },

        //see: http://www.movable-type.co.uk/scripts/latlong.html
        distance: function distance(lat1, lon1, lat2, lon2) {
            lat1 = rad(lat1);
            lat2 = rad(lat2);
            lon1 = rad(lon1);
            lon2 = rad(lon2);

            var dLat = lat2-lat1,
                dLon = lon2-lon1;
            
            var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon/2) * Math.sin(dLon/2);
            var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

            return R * c;
        },

        bearing: function bearing(lat1, lon1, lat2, lon2) {
            lat1 = rad(lat1);
            lat2 = rad(lat2);
            lon1 = rad(lon1);
            lon2 = rad(lon2);
            
            var dLon = lon2-lon1;
            
            var y = Math.sin(dLon) * Math.cos(lat2);
            var x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
            
            return deg( Math.atan2(y, x) );
        },

        steer: function steer(from, to) {
            var diff = to - from;
            

            return diff;
        },

        crossTrackError: function crossTrackError(fromLat, fromLon, lat, lon, toLat, toLan) {
            var d = distance(fromLat, fromLon, toLat, toLan);
            var b1 = bearing(fromLat, fromLon, toLat, toLan);
            var b2 = bearing(fromLat, fromLon, lat, lon);
            return Math.asin(Math.sin(d/R) * Math.sin(rad(b2-b1))) * R;
        },

        set: function set(speed, hdg, sog, cog) {
            //GM: TODO: understand 90 deg offset.
            //convert cog and hdg to radians, with north right
            hdg = rad(90.0 - hdg);
            cog = rad(90.0 - cog);

            //break out x and y components of current vector
            var current_x = sog * Math.cos(cog) - speed * Math.cos(hdg);
            var current_y = sog * Math.sin(cog) - speed * Math.sin(hdg);

            //set is the angle of the current vector (note we special case pure North or South)
            var _set = 0;
            if ( current_x === 0 ) {
                _set = current_y < 0? 180: 0;
            }
            else {
                //normalize 0 - 360
                _set = calcs.normalizeHeading(90.0 - deg(Math.atan2(current_y, current_x)), 360);
            }
            return _set;
        },

        drift: function drift(speed, hdg, sog, cog) {
            //GM: TODO: understand 90 deg offset.
            //convert cog and hdg to radians, with north right
            hdg = rad(90.0 - hdg);
            cog = rad(90.0 - cog);

            //break out x and y components of current vector
            var current_x = sog * Math.cos(cog) - speed * Math.cos(hdg);
            var current_y = sog * Math.sin(cog) - speed * Math.sin(hdg);

            //drift is the magnitude of the current vector
            var _drift = Math.sqrt(current_x * current_x + current_y * current_y);
            return _drift;
        },

        offest: function( offset ) {
            return function(value) {
                return value + offset;
            }
        },

        multiplied: function( factor ) {
            return function(value) {
                return value * factor;
            }
        },

        normalizeAngle: function(awa) {
            if (awa > 180) {
                awa = -1 * (360 - awa);
            }
            if (awa < -180) {
                awa = (360 + awa);
            }
            return awa;
        },

        normalizeHeading: function(heading, base) {
            base = base || 360;

            return (heading + base) % base;
        },

        adjustAwaForHeel: function( awa, heel ) {
            var adjustedAwa = deg(Math.atan( Math.tan(rad(awa)) / Math.cos(rad(heel)) ));
            if (awa > 90) {
                adjustedAwa += 180;
            }
            if (awa < -90) {
                adjustedAwa -= 180;
            }
            return adjustedAwa;
        },



        courseDistance: function courseLength(course, marks) {
            var distance = 0;
            for (var i=1; i < course.length; i++) {
                if ( course[i-1] in marks && course[i] in marks ) {
                    distance += calcs.distance( marks[course[i-1]][1], marks[course[i-1]][0], 
                                                marks[course[i]][1], marks[course[i]][0] );
                }
            }
            return distance;
        }
    };

    _.extend(exports, calcs);
}));
