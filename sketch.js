const canvasSketch = require('canvas-sketch');
const { polylinesToSVG } = require('canvas-sketch-util/penplot');
const random = require('canvas-sketch-util/random');
const clustering = require('density-clustering');
const convexHull = require('convex-hull');
const concaveman = require('concaveman');
const d3 = require('d3-contour');

const debug = false;

const settings = {
    dimensions: [ 1200, 1200 ],
    animate: true,
    fps: 25,
    duration: 500 * 10,
    scaleToView: true,
    playbackRate: 'throttle'
};

const sketch = ({ width, height, units, render }) => {
  // Noise parameters
  const freq = 1 / width;
  const amp = 50;
  function gen_noise(x, y) {
      return random.noise2D(x, y, freq, amp)
           + random.noise2D(x, y, freq * 2, amp / 2)
           + random.noise2D(x, y, freq * 4, amp / 4);
  }
  // Vertical space between contours
  const contour_distance = 7;
  const thresholds = [];
  for(let x = -amp; x < amp; x+=contour_distance) {
      thresholds.push(x);
  }

  let contour_height = -amp/4;
  let grid = [];
  let x_off = 0;
  let y_off = 0;
  let x_shift = 0.5;
  let y_shift = 0.25;

  function renoise_grid() {
      grid = [];
      for(let x = x_off; x < width + x_off; x++) {
          let col = [];
          for(let y = y_off; y < height + y_off; y++) {
              col.push(gen_noise(x, y));
          }
          grid.push(col);
      }
      x_off += x_shift;
      y_off += y_shift;
  }
  renoise_grid();

  // We will add to this over time
  let lines = [];

  // Thickness of pen in cm
  const penThickness = 1;

  // Run at 30 FPS until we run out of points
  let loop = setInterval(() => {
    if (!integrate()) {
        render();
        return clearInterval(loop);
    }
    else {
        render();
    }
  }, 500);

  return {
    render: ({ context, width, height, playhead }) => {
        context.fillStyle = 'hsl(0, 0%, 5%)';
        context.fillRect(0, 0, width, height);

        context.save();

        // Draw lines
        lines.forEach(points => {
          context.beginPath();
          points.forEach(p => context.lineTo(p[0], p[1]));
          context.strokeStyle = debug ? 'blue' : 'white';
          context.lineWidth = penThickness;
          context.lineJoin = 'round';
          context.lineCap = 'round';
          context.stroke();
        });

        context.restore();
    },
    begin: () => {

    }
  }
  function in_frame(point) {
      return point.x < width && point.x >= 0 && point.y < height && point.y >= 0;
  }
  function get_contour_groupings(grid, at_height) {
      function contains(collection, point) {
          for(let i = 0; i < collection.length; i++) {
              if(collection[i].x === point.x && collection[i].y === point.y) return true;
          }
          return false;
      }

      var valids = [];
      for(let x = 0; x < grid.length; x++) {
          for(let y = 0; y < grid[x].length; y++) {
              if(grid[x][y] >= at_height) {
                  valids.push({x: x, y: y});
              }
          }
      }

      groupings = [];

      while(valids.length > 0) {
          var visited = [];
          var frontier = [valids[0]];
          var i = 0;
          while(frontier.length > 0) {
              current = frontier.pop();
              // Register that we visited the current node
              if(!contains(visited, current)) {
                  visited.push(current);
              }

              // List spacial neighbors
              curr_x = current.x;
              curr_y = current.y;
              const neighbors = [
                  {x: curr_x + 1, y: curr_y},
                  {x: curr_x - 1, y: curr_y},
                  {x: curr_x, y: curr_y + 1},
                  {x: curr_x, y: curr_y - 1}
              ];
              // Add neighbors to frontier
              neighbors.forEach(function (neighbor) {
                  // but only if they are high up and haven't been visited yet
                  if(in_frame(neighbor) &&
                     grid[neighbor.x][neighbor.y] >= at_height &&
                     !contains(visited, neighbor)) {
                      frontier.push(neighbor);
                      visited.push(neighbor);
                  }
              });
          }
          // Collect visited points and push to groupings
          groupings.push(visited);

          // Remove visited points from valid points
          valids = valids.filter(point => !contains(visited, point));
      }
      return groupings;
  }
  function get_d3_contour_groupings(grid) {
      let flattened_grid = [];
      for(let x = 0; x < grid.length; x++) {
          for(let y = 0; y < grid[x].length; y++) {
              flattened_grid.push(grid[x][y]);
          }
      }

      var polys = d3.contours()
          .size([grid.length, grid[0].length])
          .thresholds(thresholds)
          (flattened_grid);

      let contours = [];
      for(let i = 0; i < polys.length; i++) {
          for(let j = 0; j < polys[i].coordinates.length; j++) {
              contours.push(polys[i].coordinates[j][0]);
          }
      }
      return contours.map(contour => contour);
  }
  function integrate () {
    let contours = get_d3_contour_groupings(grid, contour_height);

    // Find the hull of the cluster
    lines = [];
    for(let i = 0; i < contours.length; i++) {
        // Create a closed polyline from the hull
        let path = contours[i].map(point => point);
        // Add to total list of polylines
        lines.push(path);
    }
    renoise_grid()
    return true;
  }
};

canvasSketch(sketch, settings);
