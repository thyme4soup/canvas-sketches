
import canvasSketch from 'canvas-sketch';
import load from 'load-asset';
import * as d3 from 'd3-contour';
import { renderPolylines } from 'canvas-sketch-util/penplot';
import { clipPolylinesToBox } from 'canvas-sketch-util/geometry';

const image_uri = 'assets/apple.jpg';

function get_d3_contour_groupings(values, width, height) {
    var polys = d3.contours()
        .size([width, height])
        (values);

    let contours = [];
    for(let i = 0; i < polys.length; i++) {
        for(let j = 0; j < polys[i].coordinates.length; j++) {
            contours.push(polys[i].coordinates[j][0]);
        }
    }
    return contours.map(contour => contour);
}
function get_contour_lines(values, width, height) {
    // get contours using d3 library
    let contours = get_d3_contour_groupings(values, width, height);

    // push lines as a path for each contour
    let lines = [];
    for(let i = 0; i < contours.length; i++) {
        // we could do transformations here (we do the translations in the get_d3_contour_groupings)
        let path = contours[i].map(point => point);

        // add to total list of polylines
        lines.push(path);
    }

    return lines;
}

canvasSketch(async ({ update }) => {
  const image = await load(image_uri);

  // Update our sketch with new settings
  update({
    dimensions: [ image.width, image.height ]
  });

  // Render our sketch
  return ({ context, width, height }) => {
    // Render to canvas
    context.drawImage(image, 0, 0, width, height);

    // Extract bitmap pixel data
    const pixels = context.getImageData(0, 0, width, height);

    // Manipulate pixels
    const data = pixels.data;
    let len = width;
    let values = [];
    for(let i = 0; i < data.length; i+= 4) {
        let pixel_val = (data[i + 0] + data[i + 1] + data[i + 2]) / 3;
        values.push(pixel_val);
    }

    let lines = get_contour_lines(values, width, height);

    // Clip all the lines to a margin
    const margin = 1.0;
    const box = [ margin, margin, width - margin, height - margin ];
    lines = clipPolylinesToBox(lines, box);

    console.log(lines);
    context.fillStyle = 'white';
    context.fillRect(0, 0, width, height);

    context.lineWidth = '1';
    context.strokeStyle = 'black';


    lines.map(line => {
        let last = null;
        line.map(point => {
            context.beginPath();
            if(last) {
                context.moveTo(last[0], last[1]);
                context.lineTo(point[0], point[1]);
                context.stroke();
            }
            last = point;
        });
    });
  };
});
