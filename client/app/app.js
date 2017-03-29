var iconAttrs = { fill: 'white', stroke: 'black', 'stroke-width': 0.4};
var iconSize  = 1.2;
var socket    = io();
var objects   = {};

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

var PathFinder = function() {
    
    var component = this;

    /**
     * 
     */
    this.elementToPath = function(element) {

        var path;

        if (element.is('line')) {
            var x1 = element.attr('x1');
            var x2 = element.attr('x2');
            var y1 = element.attr('y1');
            var y2 = element.attr('y2');
            path = 'M ' + x1 + ' ' + y1 + ' ' + x2 + ' ' + y2;
        } else if (element.is('path')) {
            path = element.attr('d');
        }

        return path;

    };

    /**
     * Generate a path from <startPoint> to <endPoint> when path encompasses more than one
     * stop - ie: when the train is running fast between two stations, and not stopping at ones in between
     */
    this.findRoutePath = function(lineId, startPoint, endPoint) {

    };

    this.getNearest = function(a, b, c) {

        console.log(a, b, c);

        if (!a || !b || !c)
            return a;
        
        var atoc = Math.sqrt(((a.x - c.x) * (a.x - c.x)) + ((a.y - c.y) * (a.y - c.y)));
        var btoc = Math.sqrt(((b.x - c.x) * (b.x - c.x)) + ((b.y - c.y) * (b.y - c.y)));

        console.log('atoc/btoc:', atoc, btoc);

        if (atoc < btoc)
            return a;

        return b;

    }

    this.getOrientation = function(path, startPoint, endPoint) {
        
        var pathOrigin = component.getPathOrigin(path);
        
        if (component.getNearest(pathOrigin, startPoint, endPoint) === startPoint)
            return 1;

        return -1;
    
    };

    /**
     * Main function to get the animation path
     */
    this.getPath = function(lineId, startPoint, endPoint) {
        
        var animationPath, 
            element = component.getRouteElement(lineId, startPoint, endPoint);

        if (element)
            animationPath = component.elementToPath(element);
        else {
            console.log('finding route ..');
            animationPath = component.findRoutePath(lineId, startPoint, endPoint);
        }

        if (animationPath) {
            console.log('getPath success!');
            var startXY = component.getStationPoint(lineId, startPoint);
            var endXY   = component.getStationPoint(lineId, endPoint);

            return {
                path:        animationPath,
                orientation: component.getOrientation(animationPath, startXY, endXY)
            };
        }
        console.log('getPath failure :(');
        return null;

    };


    this.getPathOrigin = function(path) {

        var point = path.match(/^\s*M\s*([0-9\.]+)[\, ]([0-9\.]+)/);

        return {
            x: point[1],
            y: point[2]
        };

    };

    this.getRouteElement = function(lineId, startPoint, endPoint) {
        
        var selector1 = '#lul-' + lineId + '_' + startPoint.toLowerCase() + '_' + endPoint.toLowerCase();

        if ($(selector1).length)
            return $(selector1);

        var selector2 = '#lul-' + lineId + '_' + endPoint.toLowerCase() + '_' + startPoint.toLowerCase();

        if ($(selector2).length)
            return $(selector2);

    };

    this.getStationPoint = function(lineId, naptanId) {

        var selector = 'rect#lul-' + lineId + '_' + naptanId.toLowerCase();

        if ($(selector).length) {
            return {
                x: $(selector).attr('x'),
                y: $(selector).attr('y')
            };
        }

        selector = 'g#s-' + naptanId.toLowerCase() + '_1_ > path';

        if ($(selector).length) {
            var point = component.getPathOrigin($(selector).attr('d'));
            return {
                x: point.x,
                y: point.y
            };
        }

    };

};

var raphael    = new Raphael('raphael-canvas', 2000, 1400);
var pathFinder = new PathFinder();

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

var showVehicleInfo = function(vehicle) {
    $('#vehicle-info').show();
    $('#test').html(JSON.stringify(vehicle, null, 2));
};

socket.on('update', function(result) {
    
    //console.log(result);
    var lineId = result.line;

    if (!(lineId in objects))
        objects[lineId] = [];

    objects[lineId].map(function(vehicle) {
        try {
            vehicle.remove();
        } catch (e) {

        }
    });

    objects[lineId] = [];

    for (var vehicleId in result.data) {

        var vehicle = result.data[vehicleId];
        
        switch (vehicle.state) {

            case 'stopped':
                
                var point = pathFinder.getStationPoint(lineId, vehicle.at);

                if (point) {
                    //console.log('got station point for vehicle:', vehicle, point);
                    objects[lineId].push(
                        raphael.circle(point.x, point.y, iconSize)
                            .attr(iconAttrs)
                            .data('vehicle', vehicle)
                            .click(function() {
                                showVehicleInfo(this.data('vehicle'))
                            })                      
                    );
                } else {
                    //console.error('Unable to get station point for vehicle:', vehicle);
                }

                //var icon = vehicleOverlay.path().attr({ stroke: 'none', fill: 'none'});
                /*
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
                */
                break;
            case 'animate':
                /*
                var animation = pathFinder.getPath(lineId, vehicle.from, vehicle.to);

                if (animation) {


                    console.log('got animation path:', animation, vehicle);

                    if (animation.orientation == -1) {
                        var start = 1 - vehicle.offset;
                        var end   = 0;
                    } else {
                        var start = vehicle.offset;
                        var end   = 1;
                    }

                    var vehiclePath = raphael.path(animation.path).attr({ stroke: 'none', fill: 'none'});
                    var vehicleIcon = raphael.circle(0, 0, iconSize)
                      .attr({
                        fill: 'white', stroke: 'black', 'stroke-width': 0.4
                    })
                      .data('vehicle', vehicle)
                      .click(function() {
                        showVehicleInfo(this.data('vehicle'))
                      });

                    vehicleIcon.attr({
                        guide : animation.path, 
                        along : start
                    }).animate({along : end}, vehicle.duration * 1000, "linear");

                    objects[lineId].push(vehiclePath);
                    objects[lineId].push(vehicleIcon);

                } else {
                    console.error('Unable to get animation path for vehicle:', vehicle);
                }
                */
                
                var routeElement = getRouteElement(lineId, vehicle.from, vehicle.to);
                if (routeElement) {
                    /*
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
                    */

                    var animation = pathFinder.getPath(lineId, vehicle.from, vehicle.to);
                    var vehiclePath = raphael.path(animation.path).attr({ stroke: 'none', fill: 'none'});

                    vehicle.path = routeElement.element.attr('id');
                    var vehicleIcon = raphael.circle(0, 0, 1.2).attr({
                        fill: 'white', stroke: 'black', 'stroke-width': 0.4
                    }).data('vehicle', vehicle)
                      .click(function() {
                        showVehicleInfo(this.data('vehicle'))
                      })
                    
                    if (animation.orientation == -1) {
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

                    objects[lineId].push(vehiclePath);
                    objects[lineId].push(vehicleIcon);

                } else {
                    //console.log('element not found', vehicle);
                }
                
                break;
            
        }
        //break;

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