function process(src) {
    const img = document.createElement("img");
    const input = document.getElementById("input");
    const canny = document.getElementById("canny");
    const hough = document.getElementById("hough");
    const lines = document.getElementById("lines");
    const shapes = document.getElementById("shapes");
    const output = document.getElementById("output");

    img.onload = () => {
        const w = input.width = canny.width = hough.width = lines.width = shapes.width = img.width;
        const h = input.height = canny.height = hough.height = lines.height = shapes.height = img.height;

        const ctx = input.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const cannyData = buildCanny(ctx.getImageData(0, 0, w, h));
        const lineList = buildHough(cannyData, w, h);
        const [ processedLines, ratio ] = processLines(lineList);
        const shapeList = findShapes(processedLines);
        console.log(ratio, processedLines, shapeList);

        drawCanny(cannyData, canny);
        drawLines(lineList, hough.getContext('2d'), w, h, 1);
        drawLines(processedLines, lines.getContext('2d'), w, h, 5);
        drawShapes(shapeList, shapes.getContext('2d'), w, h, 5);

        output.width = ratio*500;
        output.height = 500;
        drawShapes100(shapeList, output.getContext('2d'), 500, ratio)
    }
    img.src = src
}

function buildCanny(imageData) {
    const highTreshold = 250;
    const lowTreshold = 250;
    const blurRadius = 2;
    return applyCanny(imageData, blurRadius, lowTreshold, highTreshold)
}

function drawCanny(imageData, canvas) {
    canvas.getContext('2d').putImageData(imageData, 0, 0)
}

function buildHough(cannyData, w, h) {
    const edgeImg = cannyData.data.filter((x, i) => i % 4 === 0).map(x => x < 100 ? 0 : 1),
        rho = 1,
        theta = Math.PI / 180,
        threshold = 150,//250, // The minimum number of intersections to “detect” a line
        lineLength = 50, // The minimum number of points that can form a line. Lines with less than this number of points are disregarded.
        lineGap = 10,  // The maximum gap between two points to be considered in the same line.
        linesMax = 10000 //Maximum amount of lines to find
    return probabilisticHoughTransform(edgeImg, w, h, rho, theta, threshold, lineLength, lineGap, linesMax)
}

function drawLines(lines, ctx, w, h, lw) {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = lw;
    const strokes = [ 'red', 'green', 'blue', 'orange', 'yellow', 'pink', 'purple' ];
    for(let [ p1, p2, lengthInfo ] of lines) {
        if(lengthInfo) ctx.strokeStyle = strokes[lengthInfo.index];
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke()
    }
}

function drawShapes(shapes, ctx, w, h, lw) {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = lw;
    const strokes = [ 'red', 'green', 'blue', 'orange', 'yellow', 'pink', 'purple' ];
    let i = 0;
    for (let points of shapes) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let { x, y } of points) {
            ctx.lineTo(x, y)
        }
        ctx.lineTo(points[0].x, points[0].y);
        ctx.strokeStyle = strokes[(i++) % strokes.length];
        ctx.stroke()
    }
}

function drawShapes100(shapes, ctx, w, ratio) {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, w * ratio, w);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1;
    const strokes = [ 'red', 'green', 'blue', 'orange', 'yellow', 'pink', 'purple' ];
    let i = 0;
    for (let points of shapes) {
        ctx.beginPath();
        ctx.moveTo(points[0].normalX * w * ratio, points[0].normalY * w);
        for (let { normalX, normalY } of points) {
            ctx.lineTo(normalX * w * ratio, normalY * w)
        }
        ctx.lineTo(points[0].normalX * w * ratio, points[0].normalY * w);
        ctx.closePath()
        ctx.strokeStyle = strokes[(i++) % strokes.length];
        ctx.stroke()
    }
}

const DELTA = 10;
function near({ x: x1, y: y1 }, { x: x2, y: y2 }) {
    return Math.abs(x1-x2) < DELTA && Math.abs(y1-y2) < DELTA;
}

function avg({ x: x1, y: y1 }, { x: x2, y: y2 }) {
    return {
        x: (x1+x2)/2,
        y: (y1+y2)/2
    }
}

//Merges lines too near, this will remove duplicates generated for strong lines...
function mergeLines(lines) {
    const newLines = [];
    for(let line1 of lines) {
        if(line1[2]) continue;
        for(let line2 of lines) {
            if(line2[2]) continue;
            if(line1 !== line2) {
                const [ p11, p12 ] = line1;
                const [ p21, p22 ] = line2;
                if(near(p11, p21) && near(p12, p22)) {
                    newLines.push([ avg(p11, p21), avg(p12, p22) ]);
                    line1.push(true);
                    line2.push(true)
                }
            }
        }
    }
    //Avoid non-mergable lines as these are not part of a real line
   /* for(let line of lines) {
        if(line[2]) continue;
        newLines.push(line)
    }*/
    return newLines
}

function lineLength([ p1, p2 ]) {
    return Math.sqrt(Math.pow(p2.x-p1.x, 2) + Math.pow(p2.y-p1.y, 2))
}

function round(value, target) {
    return +(value.toFixed(target||1))
}

//Make similar length lines equal length lines...
const DELTA_LENGTH = 2;
function normaliseLines(lines) {
    const linesWithLength = lines.map(line => [ ...line, lineLength(line) ])
    const lengths = [];

    let minPositionX = 10000, maxPositionX = 0;
    let minPositionY = 10000, maxPositionY = 0;
    liner: for (let line of linesWithLength) {
        minPositionX = Math.min(minPositionX, line[0].x, line[1].x)
        minPositionY = Math.min(minPositionY, line[0].y, line[1].y)
        maxPositionX = Math.max(maxPositionX, line[0].x, line[1].x)
        maxPositionY = Math.max(maxPositionY, line[0].y, line[1].y)

        const current = line[2];
        for (let length of lengths) {
            if(Math.abs(current-length.value) < DELTA_LENGTH) {
                line[2] = length
                continue liner
            }
        }
        lengths.push(line[2] = { value: current })
    }

    const sortedLengths = lengths.sort((a,b) => b.value-a.value);
    const min = sortedLengths.pop();
    min.normalValue = 1;
    min.index = 0;

    const normalValues = [ 1 ];
    for(let length of sortedLengths) {
        length.normalValue = round(length.value / min.value);
        let index = normalValues.indexOf(length.normalValue);
        if(index === -1) {
            index = normalValues.length;
            normalValues.push(length.normalValue)
        }
        length.index = index
    }

    const position100X = maxPositionX - minPositionX;
    const position100Y = maxPositionY - minPositionY;
    const ratio = position100X / position100Y;

    for(let [ p1, p2 ] of lines) {
        p1.normalX = round((p1.x - minPositionX) / position100X, 3);
        p1.normalY = round((p1.y - minPositionY) / position100Y, 3);
        p2.normalX = round((p2.x - minPositionX) / position100X, 3);
        p2.normalY = round((p2.y - minPositionY) / position100Y, 3)
    }

    return [ linesWithLength, ratio ]
}

function normaliseCorners(lines) {
    let points = [];
    liner: for (let line of lines) {
        let notFound = true;
        for (let point of points) {
            if(near(line[0], point)) {
                line[0] = point;
                notFound = false;
                break;
            }
        }
        if(notFound) {
            points.push(line[0])
        }
        for (let point of points) {
            if(near(line[1], point)) {
                line[1] = point;
                continue liner
            }
        }
        points.push(line[1])
    }

    return lines
}

function processLines(lines) {
    const [ _lines, ratio ] = normaliseLines(mergeLines(lines))
    return [ normaliseCorners(_lines), ratio ]
}

function findShapes(lines) {
    const shapes = [];
    let shape = null, firstPoint, lastPoint;
    do {
        for (let line of lines) {
            const [p1, p2, , used] = line;
            if (!used) {
                if (shape) {
                    if (p1 === lastPoint) {
                        if(p2 === firstPoint) {
                            shape = firstPoint = lastPoint = null
                        }
                        else {
                            shape.push(lastPoint = p2)
                        }

                        line[3] = true
                    }
                    else if (p2 === lastPoint) {
                        if(p1 === firstPoint) {
                            shape = firstPoint = lastPoint = null
                        }
                        else {
                            shape.push(lastPoint = p1)
                        }

                        line[3] = true
                    }
                }
                else {
                    shapes.push(shape = [ firstPoint = p1, lastPoint = p2]);
                    line[3] = true
                }
            }
        }
        const lastLines = lines;
        lines = lines.filter(l => !l[3]); //not used
        if(lastLines.length === lines.length) break;
    }
    while(lines.length);

    return shapes //.map(shape => shape.sort((a,b) => (a.normalX-b.normalX)||(a.normalY-b.normalY)))
}


process('./sample.png')