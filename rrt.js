const canvasSketch = require('canvas-sketch');
const { renderPolylines } = require('canvas-sketch-util/penplot');
const { clipPolylinesToBox } = require('canvas-sketch-util/geometry');
const { polylinesToSVG } = require('canvas-sketch-util/penplot');

const settings = {
    dimensions: 'A4',
    orientation: 'portrait',
    pixelsPerInch: 300,
    scaleToView: true,
    units: 'cm',
};

const debug = false;

const rrt = {
    points: [],
    edges: new Map(),
    frontier: [],
    dist_limit: 0.3,
    neighborhood: 0.4,
    iter_limit: 1500,
    costs: new Map(),
};

function arr_remove(arr, elt) {
    for( var i = 0; i < arr.length; i++){
        if ( arr[i] === elt) {
            arr.splice(i, 1);
        }
    }
}
function distance(p1, p2) {
    return Math.hypot(p1[0] - p2[0], p1[1] - p2[1]);
}
function scale_vector(vector, scalar) {
    return vector.map(p => p * scalar);
}
function norm(vector, scalar) {
    let dist = Math.hypot(vector[0], vector[1]);
    return vector.map(p => p * scalar / dist);
}
function add_points(p1, p2) {
    return [p1[0] + p2[0], p1[1] + p2[1]];
}
function closest(list, point) {
    let best = list[0];
    for(var i = 0; i < list.length; i++) {
        if(distance(point, list[i]) < distance(point, best)) {
            best = list[i];
        }
    }
    return best;
}
function new_parent_is_valid(p, new_parent) {
    let current = p;
    while(current) {
        current = rrt.edges.get(current);
        if(current == new_parent) return false;
    }
    return true;
}
function cost(p) {
    let parent = rrt.edges.get(p);
    if(parent) {
        return distance(p, parent) + cost(parent);
    }
    else {
        return 0;
    }
}
function closest_towards(source, dest, dist) {
    if(distance(source, dest) <= dist) {
        return dest;
    }
    else {
        // TODO:
        let delta = add_points(dest, scale_vector(source, -1));
        let unit = norm(delta, 1);
        let limited_dest = add_points(source, scale_vector(unit, rrt.dist_limit));
        let new_dest = closest(rrt.frontier, limited_dest);
        return new_dest;
    }
}
function map_to_edges(edge_map) {
    edges = [];
    edge_map.forEach((parent, node, map) => {
        edges.push([parent, node]);
    });
    return edges;
}

function rrt_iter() {
    if(rrt.iter_limit > 0 && rrt.frontier.length > 0) {
        let dest = rrt.frontier[Math.floor(Math.random()*rrt.frontier.length)];
        let near = closest(rrt.points, dest)
        let pnew = closest_towards(near, dest, rrt.dist_limit, rrt.frontier)

        rrt.points.push(pnew)
        rrt.edges.set(pnew, near)
        arr_remove(rrt.frontier, pnew)

        rrt.iter_limit = rrt.iter_limit - 1
        return true;
    }
    else {
        return false;
    }
}
function rrt_star_iter() {
    if(rrt.iter_limit > 0 && rrt.frontier.length > 0) {
        let dest = rrt.frontier[Math.floor(Math.random()*rrt.frontier.length)];
        let near = closest(rrt.points, dest);
        let pnew = closest_towards(near, dest, rrt.dist_limit, rrt.frontier);

        // populate neighbors
        let neighbors = [];
        rrt.points.forEach(p => {
            if(distance(p, pnew) <= rrt.neighborhood) {
                neighbors.push(p);
            }
        });

        // get best candidate
        let least_cost = neighbors[0];
        neighbors.forEach(neighbor => {
            if(cost(neighbor) + distance(neighbor, pnew) < cost(least_cost) + distance(least_cost, pnew)) {
                least_cost = neighbor;
            }
        })
        // add points
        rrt.points.push(pnew);
        rrt.edges.set(pnew, least_cost);
        arr_remove(rrt.frontier, pnew);

        // recalculate neighborhood edges
        neighbors.forEach(neighbor => {
            let cost_candidate = cost(pnew) + distance(neighbor, pnew);
            if(neighbor != rrt.edges.get(pnew) && cost_candidate < cost(neighbor)) {
                rrt.edges.set(neighbor, pnew);
            }
        });

        rrt.iter_limit = rrt.iter_limit - 1;
        return true;
    }
    else {
        return false;
    }
}

//////////////
const sketch = ({ width, height, units, render }) => {
    const resolution = 10;
    let width_;
    let height_;
    if(units === "cm") {
        width_ = width * resolution;
        height_ = height * resolution;
    }
    else if(units === "px") {
        width_ = width;
        height_ = height;
    }

    let grid = [];
    for(let y = 0; y < height; y+=height/height_) {
        for(let x = 0; x < width; x+=width/width_) {
            rrt.frontier.push([x, y])
        }
    }
    rrt.points.push([width/2, height/2])
    rrt.costs.set(rrt.points[0], 0)

    let loop = setInterval(() => {
      const remaining = integrate();
      if (!remaining) return clearInterval(loop);
      render();
  }, 1000 / 30);

    return ({ context }) => {
        // Clear canvas
        context.clearRect(0, 0, width, height);

        // Fill with white
        context.fillStyle = 'white';
        context.fillRect(0, 0, width, height);

        // Thickness of pen in cm
        const penThickness = 0.03;

        // Clip all the lines to a margin
        const margin = 1;
        const box = [ margin, margin, width - margin, height - margin ];
        const edges = map_to_edges(rrt.edges);
        const lines = clipPolylinesToBox(edges, box);
        const points = rrt.frontier;

        // Draw lines
        lines.forEach(points => {
            context.beginPath();
            points.forEach(p => context.lineTo(p[0], p[1]));
            context.strokeStyle = debug ? 'blue' : 'black';
            context.lineWidth = penThickness;
            context.lineJoin = 'round';
            context.lineCap = 'round';
            context.stroke();
        });

        // Draw points
        if (debug) {
          points.forEach(p => {
            context.beginPath();
            context.arc(p[0], p[1], 0.02, 0, Math.PI * 2);
            context.strokeStyle = context.fillStyle = 'red';
            context.lineWidth = penThickness;
            context.fill();
          });
        }

        return [
            // Export PNG as first layer
            context.canvas,
            // Export SVG for pen plotter as second layer
            {
                data: polylinesToSVG(lines, {
                    width,
                    height,
                    units
                }),
                extension: '.svg'
            }
        ];
    };
    function integrate () {
        return rrt_star_iter();
    }
};

canvasSketch(sketch, settings);
