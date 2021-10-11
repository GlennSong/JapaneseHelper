#!/usr/bin/env node

//helpful links. How I started this project and learned about the cli thing: 
//https://developer.okta.com/blog/2019/06/18/command-line-app-with-nodejs
import yargs from 'yargs';
import kanji from "./kanji.mjs";
import fs from 'fs';

// module.exports = {
//     getKanjiArray,
//     getJapaneseWord,
//     buildKanjiTable,
//     buildJapaneseWordTable,
//     BuildJapaneseWorksheet
// }

const options = yargs
 .usage("Usage: -t <japanese text>")
 .option("t", { alias: "text", describe: "Japanese text", type: "string", demandOption: false })
 .option("f", { alias: "file", describe: "Read Japanese text from file.", type: "string", demandOption: false })
 .option("k", { alias: "kanji", describe: "Japanese kanji", type: "string", demandOption: false })
 .argv;

if(options.kanji !== undefined) 
{
    // result = await kanji.getKanjiArray("建");
    result = await kanji.getKanjiArray(options.kanji);
    console.log("kanji: " + JSON.stringify(result));   
}
else if(options.text !== undefined) 
{
    // var result = await kanji.getJapaneseWord("建物");
    var result = await kanji.getJapaneseWord(options.text);
    console.log("Words: " + JSON.stringify(result));
}
else if(options.file !== undefined) 
{
    fs.readFile(options.file, 'utf8', async (error, data) => {
        // console.log(data);
        // var result = await kanji.buildJapaneseWordTable(data);
        var results = await kanji.BuildJapaneseWords_v2(data);
        createCSV(results, ["word, hiragana, meaning"]);
    });
}

function createCSV(wordList, headers) 
{
    var csv = headers.join(",") + "\n";
    for(let i=0; i<wordList.length; ++i) 
    {
        csv += wordList[i].join(",") + "\n";
    }

    var currDateTime = new Date();
    var filename = "output_" + currDateTime.toUTCString().replace(/:/g, "-") + ".csv";
    fs.writeFile(filename, csv, function(err) {
        if(err) {
            return console.log(err);
        }
        console.log("Saved file.");
    });
}
