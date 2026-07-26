#target illustrator

var LETTER_WIDTH_PT = 612;  // 8.5 in
var LETTER_HEIGHT_PT = 792; // 11 in
var SPACING_MM = 20;
var PT_PER_MM = 72 / 25.4;

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
// existing top-left corner as its anchor point.
function resizeArtboardsToLetter(doc) {
    var artboards = doc.artboards;

    for (var i = 0; i < artboards.length; i++) {
        var rect = artboards[i].artboardRect; // [left, top, right, bottom]
        var left = rect[0];
        var top = rect[1];

        artboards[i].artboardRect = [left, top, left + LETTER_WIDTH_PT, top - LETTER_HEIGHT_PT];
    }
}

// 2: Lay every artboard out in a single row, starting from the first
// artboard's current position, with a fixed gap between each one.
function spaceArtboards(doc, spacingMm) {
    var artboards = doc.artboards;
    var gap = spacingMm * PT_PER_MM;

    var left = artboards[0].artboardRect[0];
    var top = artboards[0].artboardRect[1];

    for (var i = 0; i < artboards.length; i++) {
        var rect = artboards[i].artboardRect;
        var width = rect[2] - rect[0];
        var height = rect[1] - rect[3];

        var right = left + width;
        var bottom = top - height;

        artboards[i].artboardRect = [left, top, right, bottom];

        left = right + gap;
    }
}

main();
