const canvasSketch = require('canvas-sketch');
const { polylinesToSVG } = require('canvas-sketch-util/penplot');
const random = require('canvas-sketch-util/random');
const clustering = require('density-clustering');
const convexHull = require('convex-hull');
const concaveman = require('concaveman');
const d3 = require('d3-contour');
const { renderPolylines } = require('canvas-sketch-util/penplot');
const { clipPolylinesToBox } = require('canvas-sketch-util/geometry');

const debug = false;

const settings = {
    dimensions: 'A4',
    orientation: 'portrait',
    pixelsPerInch: 300,
    scaleToView: true,
    units: 'cm',
};

function get_d3_contour_groupings(grid) {
    const line_number = 20;
    let flattened_grid = [];
    for(let x = 0; x < grid.length; x++) {
        for(let y = 0; y < grid[x].length; y++) {
            flattened_grid.push(grid[x][y]);
        }
    }
    var polys = d3.contours()
        .size([grid[0].length, grid.length])
        .thresholds(line_number)
        (flattened_grid);

    let contours = [];
    for(let i = 0; i < polys.length; i++) {
        for(let j = 0; j < polys[i].coordinates.length; j++) {
            contours.push(polys[i].coordinates[j][0]);
        }
    }
    return contours.map(contour => contour);
}
function get_contour_lines(grid, resolution) {
    // get contours using d3 library
    let contours = get_d3_contour_groupings(grid);

    // push lines as a path for each contour
    let lines = [];
    for(let i = 0; i < contours.length; i++) {
        // we could do transformations here (we do the translations in the get_d3_contour_groupings)
        let path = contours[i].map(point => [point[0] / resolution, point[1] / resolution]);

        // add to total list of polylines
        lines.push(path);
    }

    return lines;
}

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

    // Noise parameters
    const freq = random.range(0.025, 0.2);
    // Amp doesn't really matter, here it varies between -50 and 50
    const amp = 50;
    function gen_noise(x, y) {
        return random.noise2D(x, y, freq, amp)
             + random.noise2D(x, y, freq * 2, amp / 2)
             + random.noise2D(x, y, freq * 4, amp / 4);
    }
    // Vertical space between contours
    const contour_distance = 5;
    const thresholds = [];
    for(let i = -amp; i < amp; i+=contour_distance) {
        thresholds.push(i);
    }

    let grid = [];
    for(let y = 0; y < height; y+=height/height_) {
        let col = [];
        for(let x = 0; x < width; x+=width/width_) {
            col.push(gen_noise(x, y));
        }
        grid.push(col);
    }

    // Thickness of pen in cm
    const penThickness = 0.03;

    let lines = get_contour_lines(grid, units === 'cm' ? resolution : 1);
    console.log(lines);

    // Clip all the lines to a margin
    const margin = 1.0;
    const box = [ margin, margin, width - margin, height - margin ];
    lines = clipPolylinesToBox(lines, box);

    // The 'penplot' util includes a utility to render
    // and export both PNG and SVG files
    return props => renderPolylines(lines, props);
};

canvasSketch(sketch, settings);
