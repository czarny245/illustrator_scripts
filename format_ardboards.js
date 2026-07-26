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
    var columns = detectColumnCount(doc);

    resizeArtboardsToLetter(doc);

    doc.rearrangeArtboards(RearrangeArtboardLayout.GridByRow, columns, SPACING_MM * PT_PER_MM, true);
}

// Reads the document's existing layout to figure out how many columns are
// already in use: counts how many artboards, starting from the first,
// share the same top coordinate (i.e. sit in the same row) before the
// row changes.
function detectColumnCount(doc) {
    var artboards = doc.artboards;
    if (artboards.length <= 1) {
        return 1;
    }

    var firstTop = artboards[0].artboardRect[1];
    var columns = 1;

    for (var i = 1; i < artboards.length; i++) {
        var top = artboards[i].artboardRect[1];
        if (Math.abs(top - firstTop) < 0.01) {
            columns++;
        } else {
            break;
        }
    }

    return columns;
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

main();
