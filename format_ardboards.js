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
    var layoutInfo = detectArtboardLayout(doc);

    resizeArtboardsToLetter(doc);

    doc.rearrangeArtboards(layoutInfo.layout, layoutInfo.rowsOrCols, SPACING_MM * PT_PER_MM, true);
}

// Reads the document's existing artboard order to figure out whether it's
// arranged row-major (moves across a row before dropping to the next one)
// or column-major (moves down a column before starting the next one), and
// how many columns/rows are already in use - so rearrangeArtboards keeps
// the same layout instead of assuming one.
function detectArtboardLayout(doc) {
    var artboards = doc.artboards;

    if (artboards.length <= 1) {
        return { layout: DocumentArtboardLayout.GridByRow, rowsOrCols: 1 };
    }

    var firstRect = artboards[0].artboardRect;
    var secondRect = artboards[1].artboardRect;

    var sameTop = Math.abs(secondRect[1] - firstRect[1]) < 0.01;
    var sameLeft = Math.abs(secondRect[0] - firstRect[0]) < 0.01;

    if (sameLeft && !sameTop) {
        // second artboard sits directly below the first -> column-major
        return { layout: DocumentArtboardLayout.GridByCol, rowsOrCols: countRun(artboards, 0) };
    }

    // default / row-major: second artboard sits next to the first
    return { layout: DocumentArtboardLayout.GridByRow, rowsOrCols: countRun(artboards, 1) };
}

// Counts how many consecutive artboards, starting from the first, share
// the same coordinate at rectIndex (1 = top, for grouping into rows;
// 0 = left, for grouping into columns).
function countRun(artboards, rectIndex) {
    var firstValue = artboards[0].artboardRect[rectIndex];
    var count = 1;

    for (var i = 1; i < artboards.length; i++) {
        var value = artboards[i].artboardRect[rectIndex];
        if (Math.abs(value - firstValue) < 0.01) {
            count++;
        } else {
            break;
        }
    }

    return count;
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
