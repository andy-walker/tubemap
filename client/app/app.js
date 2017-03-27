var iconAttrs = { fill: 'white', stroke: 'black', 'stroke-width': 0.4};
var socket    = io();
var vehicles  = {};

// http://zreference.com/raphael-animation-along-a-path/
Raphael.fn.addGuides = function() {
    
    this.ca.guide = function(g) {
        return {
            guide: g
        };
    };
    
    this.ca.along = function(percent) {
        var g = this.attr("guide");
        try {
            var len = g.getTotalLength();
            var point = g.getPointAtLength(percent * len);
        } catch (e) {
            point = {
                x: 0,
                y: 0
            };
        }
        var t = {
            transform: "t" + point.x + " " + point.y
        };
        return t;
    };

};

var raphael = new Raphael('raphael-canvas', 2000, 1400);
raphael.addGuides();

var getStationLocation = function(lineId, naptanId) {
    naptanId = naptanId.toLowerCase();
    var selector = '#lul-' + lineId + ' line[id*=' + naptanId + ']';
    
    if ($(selector).length) {
        
        var element = $(selector);
        var id      = $(selector).attr('id');
        var idParts = id.split('_');

        if (idParts[1] == naptanId) {
            return {
                x: $(selector).attr('x1'),
                y: $(selector).attr('y1')
            };
        } else if (idParts[2] == naptanId) {
            return {
                x: $(selector).attr('x2'),
                y: $(selector).attr('y2')
            };
        }

    }

    return null;
    //selector = ''

};

var getRouteElement = function(lineId, startId, endId) {
    
    var reversed = false;
    var selector = '#lul-' + lineId + '_' + startId.toLowerCase() + '_' + endId.toLowerCase();
    var element;

    if ($(selector).length) {
        element = $(selector);
    } else {
        selector = '#lul-' + lineId + '_' + endId.toLowerCase() + '_' + startId.toLowerCase();
        if ($(selector).length) {
            element  = $(selector);
            reversed = true;
        }
    }

    if (element)
        return {
            element: element,
            reversed: reversed
        };

    return null;
};

socket.on('update', function(result) {
    
    //console.log(result);
    var line = result.line;

    if (!(line in vehicles))
        vehicles[line] = [];

    vehicles[line].map(function(vehicle) {
        try {
            vehicle.remove();
        } catch (e) {

        }
    });

    vehicles[line] = [];

    for (var vehicleId in result.data) {

        var vehicle = result.data[vehicleId];
        switch (vehicle.state) {
            case 'stopped':
                //var icon = vehicleOverlay.path().attr({ stroke: 'none', fill: 'none'});
                var stationLocation = getStationLocation(line, vehicle.at);
                if (stationLocation)
                    vehicles[line].push(
                        raphael.circle(stationLocation.x, stationLocation.y, 1.2)
                            .attr(iconAttrs)
                            .data('vehicle', vehicle)
                            .click(function() {
                                console.log(JSON.stringify(this.data('vehicle'), null, 2));
                            })
                    );
                break;
            case 'animate':
                var routeElement = getRouteElement(line, vehicle.from, vehicle.to);
                if (routeElement) {
                    if (routeElement.element.is('line')) {

                        
                        //console.log('got route element - line');
                        //console.log(vehicle);
                        var x1 = routeElement.element.attr('x1');
                        var x2 = routeElement.element.attr('x2');
                        var y1 = routeElement.element.attr('y1');
                        var y2 = routeElement.element.attr('y2');
                        var path = 'M ' + x1 + ' ' + y1 + ' ' + x2 + ' ' + y2;
                        var vehiclePath = raphael.path(path).attr({ stroke: 'none', fill: 'none'});
                        

                    } else if (routeElement.element.is('path')) {
                        //console.log('got route element - path');
                        //console.log(vehicle);
 
                    }
                    vehicle.path = routeElement.element.attr('id');
                    var vehicleIcon = raphael.circle(0, 0, 1.2).attr({
                        fill: 'white', stroke: 'black', 'stroke-width': 0.4
                    }).data('vehicle', vehicle)
                      .click(function() {
                        console.log(JSON.stringify(this.data('vehicle'), null, 2));
                      })
                    
                    if (routeElement.reversed) {
                        var start = 1 - vehicle.offset;
                        var end   = 0;
                    } else {
                        var start = vehicle.offset;
                        var end   = 1;
                    }

                    //console.log('start/end', start, end);

                    vehicleIcon.attr({
                        guide : vehiclePath, 
                        along : start
                    }).animate({along : end}, vehicle.duration * 1000, "linear");

                    vehicles[line].push(vehiclePath);
                    vehicles[line].push(vehicleIcon);

                } else {
                    //console.log('element not found', vehicle);
                }
                break;
            
        }
        

    }

});
/*
var raphael = new Raphael('raphael-canvas', 2000, 1400);
vehicleOverlay.addGuides();
var path = vehicleOverlay.path($('#lul-metropolitan_940gzzlucal_940gzzlucyd').attr('d')).attr({ stroke: 'none', fill: 'none'});
//var path = 'M 125.583 173.209 h 20.254 c 1.83 0 4.387 1.059 5.681 2.353l8.496 8.499';
var circ1 = vehicleOverlay.circle(0, 0, 1).attr();
console.log(path);

circ1.attr({guide : path, along : 0}).animate({along : 1}, 60000, "linear");
*/