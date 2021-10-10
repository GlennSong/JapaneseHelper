#!/usr/bin/env node

//helpful links. How I started this project and learned about the cli thing: 
//https://developer.okta.com/blog/2019/06/18/command-line-app-with-nodejs
import yargs from 'yargs';
import kanji from "./kanji.mjs";

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
 .option("k", { alias: "kanji", describe: "Japanese kanji", type: "string", demandOption: false })
 .argv;

// const greeting = `Hello, ${options.text}!`;
// console.log(greeting);

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

// result = await kanji.getKanjiArray("建");
// console.log("kanji: " + JSON.stringify(result));
