function Canvas() {
  
}

Canvas.prototype.drawStrokeRect =
    function(ctx, color, x, y, width, height, lineWidth) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(x, y, width, height);
}

Canvas.prototype.drawFillRect =
    function(ctx, color, x, y, width, height) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
}

Canvas.prototype.drawEllipse =
    function(ctx, color, x, y, xAxis, yAxis, lineWidth, type) {
  var startX = x + xAxis;
  var startY = y;
  ctx.beginPath();
  ctx.lineWidth = lineWidth;
  ctx.moveTo(startX, startY);
  for (var i = 0; i <= 360; i++) {
    var degree = i * Math.PI / 180;
    startX = x + (xAxis - 2) * Math.cos(degree);
    startY = y - (yAxis - 2) * Math.sin(degree);
    ctx.lineTo(startX, startY);
  }
  if (type == 'rect') {
    ctx.fillStyle = changeColorToRgba(color, 0.5);
    ctx.fill();
  } else if (type == 'border') {
    ctx.strokeStyle = color;
    ctx.stroke();
  }
  ctx.closePath();
}

Canvas.prototype.setText =
    function(ctx, text, color, fontSize, fontFamily, lineHeight, x, y) {
  ctx.textBaseline = 'top';
  ctx.fillStyle = color;
  ctx.font = fontSize + ' ' + fontFamily;
  ctx.lineHeight = lineHeight;
  ctx.fillText(text, x, y);
}

Canvas.prototype.drawLine =
    function(ctx, color, lineCap, lineWidth, startX, startY, endX, endY) {
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = lineCap;
  ctx.lineTo(endX, endY);
  ctx.closePath();
  ctx.stroke();
}

Canvas.prototype.drawArrow =  function(ctx, color, lineWidth, arrowWidth,
                                       arrowHeight, lineCap, startX, startY,
                                       endX, endY) {
  var arrowCoordinates = calculateArrowCoordinates(
      arrowWidth, arrowHeight,startX, startY, endX, endY);
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = lineCap;
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.lineTo(arrowCoordinates.p1.x, arrowCoordinates.p1.y);
  ctx.moveTo(endX, endY);
  ctx.lineTo(arrowCoordinates.p2.x, arrowCoordinates.p2.y);
  ctx.closePath();
  ctx.stroke();
}

Canvas.prototype.drawRoundedRect =
    function(ctx, color, x, y, width, height, radius, type) {
  ctx.beginPath();
  ctx.moveTo(x, y + radius);
  ctx.lineTo(x, y + height - radius);
  ctx.quadraticCurveTo(x, y + height, x + radius, y + height);
  ctx.lineTo(x + width - radius, y + height);
  ctx.quadraticCurveTo(x + width, y + height, x + width, y + height - radius);
  ctx.lineTo(x + width, y + radius);
  ctx.quadraticCurveTo(x + width, y, x + width - radius, y);
  ctx.lineTo(x + radius, y);
  ctx.quadraticCurveTo(x, y, x, y + radius);
  if (type == 'rect') {
    ctx.fillStyle = changeColorToRgba(color, 0.5);
    ctx.fill();
  } else if (type == 'border') {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.closePath();
}

Canvas.prototype.blurImage = function(realCanvas, simulateCanvas, layerId, startX, startY, endX, endY) {
  var x = startX < endX ? startX : endX;
  var y = startY < endY ? startY : endY;
  var width = Math.abs(endX - startX - 1);
  var height = Math.abs(endY - startY - 1);
  simulateCanvas.width = $(layerId).clientWidth + 10;
  simulateCanvas.height = $(layerId).clientHeight + 10;
  var ctx = simulateCanvas.getContext('2d');
  try {
    ctx.drawImage(realCanvas, x, y, width, height, 0, 0, width, height);
  } catch(error) {
    console.log(error + ' width : height' + width + ' : ' + height) ;
  }
  var imageData = ctx.getImageData(0, 0, width, height);
  imageData = this.boxBlur(imageData, width, height, 10);
  ctx.putImageData(imageData, 0, 0);
}

Canvas.prototype.boxBlur = function(image, width, height, count) {
  var j;
  var pix = image.data;
  var inner = 0;
  var outer = 0;
  var step = 0;
  var rowOrColumn;
  var nextPosition;
  var nowPosition;
  for(rowOrColumn = 0; rowOrColumn < 2; rowOrColumn++) {
    if (rowOrColumn) {
      // column blurring
      outer = width;
      inner = height;
      step = width * 4;
    } else {
      // Row blurring
      outer = height;
      inner = width;
      step = 4;
    }
    for (var i = 0; i < outer; i++) {
      // Calculate for r g b a
      nextPosition = (rowOrColumn == 0 ? (i * width * 4) : (4 * i));
      for (var k = 0; k < 4; k++) {
        nowPosition = nextPosition + k;
        var pixSum = 0;
          for(var m = 0; m < count; m++) {
            pixSum += pix[nowPosition + step * m];
          }
          pix[nowPosition] = pix[nowPosition + step] =
              pix[nowPosition + step * 2] = Math.floor(pixSum/count);
          for (j = 3; j < inner-2; j++) {
            pixSum = Math.max(0, pixSum - pix[nowPosition + (j - 2) * step]
                + pix[nowPosition + (j + 2) * step]);
            pix[nowPosition + j * step] = Math.floor(pixSum/count);
          }
          pix[nowPosition + j * step] = pix[nowPosition + (j + 1) * step] =
              Math.floor(pixSum / count);
      }
    }
  }
  return image;
}

function changeColorToRgba(color, opacity) {
  var sColor = color.toLowerCase();
  var sColorChange = [];
  for (var i = 1; i < sColor.length; i += 2) {
    sColorChange.push(parseInt("0x" + sColor.slice(i, i + 2)));
  }
  return "rgba(" + sColorChange.join(",") + "," + opacity + ")";
}

// Calculate coordinates of arrow
function calculateArrowCoordinates(arrowWidth, arrowHeight,
                                   startX, startY, endX, endY) {
  var p1 = function() {
    var x = startX - endX;
    var y = startY - endY;
    var hypotenuse = Math.sqrt(x * x + y * y);
    hypotenuse = (hypotenuse == 0 ? arrowHeight : hypotenuse);
    var dx = Math.round(x / hypotenuse * arrowHeight);
    var dy = Math.round(y / hypotenuse * arrowHeight);
    return {x: endX + dx, y: endY + dy};
  }

  var p2 = function(p1, direct) {
    var x = p1.x - startX;
    var y = p1.y - startY;
    var hypotenuse = Math.sqrt(x * x + y * y);
    hypotenuse = (hypotenuse == 0 ? arrowHeight : hypotenuse);
    var dx = Math.round((y / hypotenuse * arrowWidth) * direct);
    var dy = Math.round((x / hypotenuse * arrowWidth) * direct);
    return {x: p1.x + dx, y: p1.y - dy }
  }

  return {p1:p2(p1(), 1), p2: p2(p1(), -1) } ;
}


