#target illustrator

var LETTER_WIDTH_PT = 612;  // 8.5 in
var LETTER_HEIGHT_PT = 792; // 11 in
var SPACING_MM = 20;
var PT_PER_MM = 72 / 25.4;
var COLUMNS = 5; // wrap into a grid so total extent stays within Illustrator's ~227in placement limit

function main() {
    if (app.documents.length === 0) {
        alert("No document is open.");
        return;
    }

    var doc = app.activeDocument;

    resizeArtboardsToLetter(doc);
    spaceArtboards(doc, SPACING_MM);
}

// 1: Resize every artboard to Letter format, keeping each artboard's
// current center fixed - this mirrors Illustrator's Artboard Options
// dialog with the reference point set to center.
function resizeArtboardsToLetter(doc) {
    var artboards = doc.artboards;

    for (var i = 0; i < artboards.length; i++) {
        var rect = artboards[i].artboardRect; // [left, top, right, bottom]
        var centerX = (rect[0] + rect[2]) / 2;
        var centerY = (rect[1] + rect[3]) / 2;

        var left = centerX - LETTER_WIDTH_PT / 2;
        var top = centerY + LETTER_HEIGHT_PT / 2;

        artboards[i].artboardRect = [left, top, left + LETTER_WIDTH_PT, top - LETTER_HEIGHT_PT];
    }
}

// 2: Lay every artboard out in a grid, starting from the first artboard's
// current position, with a fixed gap between each one. A grid (rather than
// one endless row) keeps the total extent within Illustrator's absolute
// placement limit (~16383pt / 227in from the ruler origin) no matter how
// many artboards there are.
function spaceArtboards(doc, spacingMm) {
    var artboards = doc.artboards;
    var gap = spacingMm * PT_PER_MM;

    var originLeft = artboards[0].artboardRect[0];
    var originTop = artboards[0].artboardRect[1];

    for (var i = 0; i < artboards.length; i++) {
        var rect = artboards[i].artboardRect;
        var width = rect[2] - rect[0];
        var height = rect[1] - rect[3];

        var col = i % COLUMNS;
        var row = Math.floor(i / COLUMNS);

        var left = originLeft + col * (width + gap);
        var top = originTop - row * (height + gap);

        artboards[i].artboardRect = [left, top, left + width, top - height];
    }
}

main();
