#target illustrator

main();

function main() {
    if (app.documents.length === 0) {
        alert('Open a document first.');
        return;
    }

    var doc = app.activeDocument;
    app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;

    // --- find template items (never touches doc.pageItems) ---
    var templates = [];
    collectTemplates(doc.textFrames, templates);
    collectTemplates(doc.groupItems, templates);

    if (templates.length === 0) {
        alert('No items named "Page Nr", "Doc Name" or "Date" found.');
        return;
    }

    // --- cache everything the per-artboard loop needs, once ---
    var abCount = doc.artboards.length;
    var abRects = [];
    for (var i = 0; i < abCount; i++) {
        abRects.push(doc.artboards[i].artboardRect);
    }

    var ctx = {
        abRects: abRects,
        abCount: abCount,
        fileNameEx: doc.name,
        fileName: doc.name.split('.').slice(0, -1).join('.'),
        dateCache: {} // per-language date strings, computed at most once each
    };

    for (var t = 0; t < templates.length; t++) {
        try {
            var item = templates[t].item;
            if (item.typename === 'GroupItem') {
                processGroup(item, templates[t].kind, ctx);
            } else {
                processTextFrame(item, templates[t].kind, ctx);
            }
        } catch (e) {
            // item may be gone (e.g. it lived inside another template group
            // that was already processed and removed) — skip it
        }
    }
}

// ------------------------------------------------------------------ templates

function collectTemplates(collection, out) {
    var kinds = { 'page nr': 'page', 'doc name': 'name', 'date': 'date' };
    var len = collection.length;
    for (var i = 0; i < len; i++) {
        var item = collection[i];
        var key = lowerTrim(item.name);
        var kind = kinds.hasOwnProperty(key) ? kinds[key] : null;
        if (kind) {
            out.push({ item: item, kind: kind });
        }
    }
}

function lowerTrim(s) {
    return s.toLowerCase().replace(/^\s+|\s+$/g, '');
}

// ------------------------------------------------------------- text template

function processTextFrame(item, kind, ctx) {
    var input = item.contents;
    var baseName = item.name;
    var anchor = getAnchor(item.geometricBounds, ctx.abRects[0]);

    // constant content is computed once; page numbers vary per artboard
    var constant = null;
    if (kind === 'name') {
        constant = docNameContent(input, ctx);
    } else if (kind === 'date') {
        constant = dateContent(input, getDateFor(item, ctx));
    }

    for (var i = 0; i < ctx.abCount; i++) {
        var dup = item.duplicate();
        var content = (constant !== null) ? constant : pageContent(input, i + 1, ctx.abCount);
        if (content !== input) {
            dup.contents = content;
        }
        dup.name = baseName + (i + 1);
        place(dup, anchor, ctx.abRects[i]);
    }
    item.remove();
}

// ------------------------------------------------------------ group template

function processGroup(group, kind, ctx) {
    var baseName = group.name;
    var anchor = getAnchor(group.geometricBounds, ctx.abRects[0]);

    // read the group's text frames and their contents once, from the original
    var frames = findTextFrames(group);
    var inputs = [];
    var constants = null; // per-frame content when it does not vary per artboard
    var j;

    for (j = 0; j < frames.length; j++) {
        inputs.push(frames[j].contents);
    }
    if (kind === 'name' || kind === 'date') {
        constants = [];
        for (j = 0; j < frames.length; j++) {
            constants.push(kind === 'name'
                ? docNameContent(inputs[j], ctx)
                : dateContent(inputs[j], getDateFor(frames[j], ctx)));
        }
    }

    for (var i = 0; i < ctx.abCount; i++) {
        var dup = group.duplicate();
        var dupFrames = findTextFrames(dup);
        var n = Math.min(dupFrames.length, inputs.length);
        for (j = 0; j < n; j++) {
            var content = constants ? constants[j] : pageContent(inputs[j], i + 1, ctx.abCount);
            if (content !== inputs[j]) {
                dupFrames[j].contents = content;
            }
        }
        dup.name = baseName + (i + 1);
        place(dup, anchor, ctx.abRects[i]);
    }
    group.remove();
}

function findTextFrames(item) {
    var arr = [];
    (function walk(it) {
        if (it.typename === 'GroupItem') {
            var kids = it.pageItems;
            var len = kids.length;
            for (var i = 0; i < len; i++) {
                walk(kids[i]);
            }
        } else if (it.typename === 'TextFrame') {
            arr.push(it);
        }
    })(item);
    return arr;
}

// ---------------------------------------------------------- token replacement

function pad2(n) {
    return n < 10 ? '0' + n : '' + n;
}

function pageContent(input, page, total) {
    return input
        .replace(/<pps>/gi, pad2(total))
        .replace(/<pp>/gi, pad2(page))
        .replace(/<ps>/gi, String(total))
        .replace(/<p>/gi, String(page));
}

function docNameContent(input, ctx) {
    return input
        .replace(/<nameex>/gi, ctx.fileNameEx)
        .replace(/<name>/gi, ctx.fileName);
}

function dateContent(input, d) {
    return input
        .replace(/<month>/gi, d.month)
        .replace(/<wd>/gi, d.wd)
        .replace(/<dd>/gi, d.dd)
        .replace(/<d>/gi, d.d)
        .replace(/<mm>/gi, d.mm)
        .replace(/<lm>/gi, d.lm)
        .replace(/<m>/gi, d.m)
        .replace(/<yyyy>/gi, d.yyyy)
        .replace(/<yy>/gi, d.yy);
}

// date strings for the language of the given text frame, cached per language
function getDateFor(textFrame, ctx) {
    var langKey = 'LanguageType.ENGLISH';
    try {
        langKey = String(textFrame.textRange.paragraphs[0].language);
    } catch (e) {
        // empty frame or no paragraph — fall back to English
    }
    if (!ctx.dateCache[langKey]) {
        ctx.dateCache[langKey] = buildDate(langKey);
    }
    return ctx.dateCache[langKey];
}

function buildDate(langKey) {
    var names = languageNames(langKey);
    var roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    var now = new Date();
    var day = now.getDate();
    var month = now.getMonth() + 1;
    var year = now.getFullYear();
    return {
        d: String(day),
        dd: pad2(day),
        m: String(month),
        mm: pad2(month),
        lm: roman[month - 1],
        month: names.Month[month - 1],
        yyyy: String(year),
        yy: pad2(year % 100),
        wd: names.WeekDay[now.getDay()]
    };
}

// -------------------------------------------------------------- positioning

// Which corner of the first artboard the template sits nearest to, and its
// offsets from that corner. Duplicates keep the same offsets on every artboard.
function getAnchor(bounds, abRect) {
    var x = nearest([bounds[0], bounds[2]], [abRect[0], abRect[2]]);
    var y = nearest([bounds[1], bounds[3]], [abRect[1], abRect[3]]);
    return {
        h: (x.itemVal === bounds[0]) ? 'L' : 'R',
        v: (y.itemVal === bounds[1]) ? 'T' : 'B',
        dx: x.dist,
        dy: y.dist
    };
}

function nearest(itemVals, abVals) {
    var best = { dist: 1e16, itemVal: itemVals[0] };
    for (var i = 0; i < itemVals.length; i++) {
        for (var j = 0; j < abVals.length; j++) {
            var d = Math.abs(itemVals[i] - abVals[j]);
            if (d < best.dist) {
                best.dist = d;
                best.itemVal = itemVals[i];
            }
        }
    }
    return best;
}

function place(item, anchor, abRect) {
    // read width/height (DOM calls) only for the corners that need them
    var x = (anchor.h === 'L')
        ? abRect[0] + anchor.dx
        : abRect[2] - anchor.dx - item.width;
    var y = (anchor.v === 'T')
        ? abRect[1] - anchor.dy
        : abRect[3] + anchor.dy + item.height;
    item.position = [x, y];
}

// ------------------------------------------------------------------ language

function languageNames(langKey) {
    var map = {
        'LanguageType.ENGLISH': {
            Month: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
            WeekDay: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        },
        'LanguageType.RUSSIAN': {
            Month: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
            WeekDay: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота']
        },
        'LanguageType.BULGARIAN': {
            Month: ['Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни', 'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'],
            WeekDay: ['Неделя', 'Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък', 'Събота']
        },
        'LanguageType.CROATIAN': {
            Month: ['siječnja', 'veljače', 'ožujka', 'travnja', 'svibnja', 'lipnja', 'srpnja', 'kolovoza', 'rujna', 'listopada', 'studenog', 'prosinca'],
            WeekDay: ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota']
        },
        'LanguageType.CZECH': {
            Month: ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'],
            WeekDay: ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota']
        },
        'LanguageType.DANISH': {
            Month: ['Januar', 'Februar', 'Marts', 'April', 'Maj', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'December'],
            WeekDay: ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag']
        },
        'LanguageType.DUTCH': {
            Month: ['Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni', 'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'],
            WeekDay: ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag']
        },
        'LanguageType.ESTONIAN': {
            Month: ['Jaanuar', 'Veebruar', 'Märts', 'Aprill', 'Mai', 'Juuni', 'Juuli', 'August', 'September', 'Oktoober', 'November', 'Detsember'],
            WeekDay: ['Pühapäev', 'Esmaspäev', 'Teisipäev', 'Kolmapäev', 'Neljapäev', 'Reede', 'Laupäev']
        },
        'LanguageType.FINNISH': {
            Month: ['Tammikuu', 'Helmikuu', 'Maaliskuu', 'Huhtikuu', 'Toukokuu', 'Kesäkuu', 'Heinäkuu', 'Elokuu', 'Syyskuu', 'Lokakuu', 'Marraskuu', 'Joulukuu'],
            WeekDay: ['Sunnuntai', 'Maanantai', 'Tiistai', 'Keskiviikko', 'Torstai', 'Perjantai', 'Lauantai']
        },
        'LanguageType.FRENCH': {
            Month: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
            WeekDay: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
        },
        'LanguageType.GERMAN': {
            Month: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
            WeekDay: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
        },
        'LanguageType.GREEK': {
            Month: ['Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος'],
            WeekDay: ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο']
        },
        'LanguageType.ITALIAN': {
            Month: ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'],
            WeekDay: ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
        },
        'LanguageType.LATVIAN': {
            Month: ['Janvāris', 'Februāris', 'Marts', 'Aprīlis', 'Maijs', 'Jūnijs', 'Jūlijs', 'Augusts', 'Septembris', 'Oktobris', 'Novembris', 'Decembris'],
            WeekDay: ['Svētdiena', 'Pirmdiena', 'Otrdiena', 'Trešdiena', 'Ceturtdiena', 'Piektdiena', 'Sestdiena']
        },
        'LanguageType.LITHUANIAN': {
            Month: ['Sausis', 'Vasaris', 'Kovas', 'Balandis', 'Gegužė', 'Birželis', 'Liepa', 'Rugpjūtis', 'Rugsėjis', 'Spalis', 'Lapkritis', 'Gruodis'],
            WeekDay: ['Sekmadienis', 'Pirmadienis', 'Antradienis', 'Trečiadienis', 'Ketvirtadienis', 'Penktadienis', 'Šeštadienis']
        },
        'LanguageType.NORWEGIAN': {
            Month: ['Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Desember'],
            WeekDay: ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag']
        },
        'LanguageType.POLISH': {
            Month: ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'],
            WeekDay: ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota']
        },
        'LanguageType.PORTUGUESE': {
            Month: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
            WeekDay: ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
        },
        'LanguageType.ROMANIAN': {
            Month: ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'],
            WeekDay: ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă']
        },
        'LanguageType.SLOVAK': {
            Month: ['januára', 'februára', 'marca', 'apríla', 'mája', 'júna', 'júla', 'augusta', 'septembra', 'októbra', 'novembra', 'decembra'],
            WeekDay: ['Nedeľa', 'Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota']
        },
        'LanguageType.SPANISH': {
            Month: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
            WeekDay: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
        },
        'LanguageType.SWEDISH': {
            Month: ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'],
            WeekDay: ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag']
        },
        'LanguageType.UKRANIAN': {
            Month: ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'],
            WeekDay: ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'Пʼятниця', 'Субота']
        }
    };
    return map[langKey] || map['LanguageType.ENGLISH'];
}
