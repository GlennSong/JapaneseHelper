/* 
Kanji Helper tools for Google Spreadsheet 
Generates a list of unique kanji from a chunk of text as well as a partial list of vocabulary words based on the text. The vocabulary words are kanji only. Anything that's a mixture of kana and kanji such as verbs or whatever don't show up in the list right now.
Author: Glenn Song
Date: 8/16/2021
Version 0.1 

Could be buggy!
*/
import fetch from 'node-fetch';

const kMinWordLen = 2;

/**
 * getKanji uses a third party API to pull in Kanji data. 
 * 
 * @param kanjiChar - the Japanese character to get data for.
 * @customfunction
 */
function getKanji(kanjiChar) {
	//format as a two-dimensional array for google spreadsheet.
	return [getKanjiArray(kanjiChar)];
}

async function getKanjiArray(kanjiChar) {
	var url = "https://kanjiapi.dev/v1/kanji/" + kanjiChar;

	var response = await fetch(url);
	var data = await response.json();
	// var data = JSON.parse(json);
	//Logger.log(data);

	var kun_reading = "";
	if (data["kun_readings"].length > 0) {
		kun_reading = data["kun_readings"][0];
	}

	var on_reading = "";
	if (data["on_readings"].length > 0) {
		on_reading = data["on_readings"][0];
	}

	return [kun_reading, on_reading, data["grade"], data["meanings"].join(', ')];
}

/** 
 * Given a character string in kanji, find a word by feeding the first character into the api call.
 * Note: This won't find verbs most likely...
 * 
 * @param getJapaneseWord - the Japanese character to get data for.
 * @customfunction
 */
async function getJapaneseWord(kanjiStr) {
	var data = await getJapaneseWordData(kanjiStr);
	if (data !== null) {
		return [
			[kanjiStr, data.pronounced, data.meanings]
		];
	} else {
		return [
			[kanjiStr, "none", "no definition"]
		];
	}
}

//This version of the function can return more than one word potentially.
async function getJapaneseWords(kanjiSearchChar, permutationList) {
	var url = "https://kanjiapi.dev/v1/words/" + kanjiSearchChar;
	var response = await fetch(url);
	var data = await response.json();
	
	var results = [];

	//run through the list of results and find the one that matches the kanji string.
	for (var setIndex = 0; setIndex < data.length; ++setIndex) {
		var variantSet = data[setIndex];
		for (var index = 0; index < variantSet.variants.length; ++index) {
			var variantInfo = variantSet.variants[index];

			//search against all of the permutations that start with the character.
			for (var perIndex = 0; perIndex < permutationList.length; ++perIndex) {
				if (variantInfo.written == permutationList[perIndex]) {
					//get the meanings
					var meanings = null;
					if (variantSet.meanings.length > 0) {
						meanings = variantSet.meanings[0].glosses.join(', ');
					}

					results.push({
						"word": variantInfo.written,
						"pronounced": variantInfo.pronounced,
						"meanings": meanings
					});
				}
			}
		}
	}

	return results;
}

async function getJapaneseWordData(kanjiStr) {
	if (kanjiStr.length <= 0) {
		return null;
	}

	var firstKanji = kanjiStr[0]

	var url = "https://kanjiapi.dev/v1/words/" + firstKanji;
	var response = await fetch(url);
	var data = await response.json();

	//run through the list of results and find the one that matches the kanji string.
	for (var setIndex = 0; setIndex < data.length; ++setIndex) {
		var variantSet = data[setIndex];
		for (var index = 0; index < variantSet.variants.length; ++index) {
			var variantInfo = variantSet.variants[index];
			if (variantInfo.written == kanjiStr) {

                //get the meanings
				var meanings = null;
				if (variantSet.meanings.length > 0) {
					meanings = variantSet.meanings[0].glosses.join(', ');
				}

				return {
					"pronounced": variantInfo.pronounced,
					"meanings": meanings
				}
			}
		}
	}

	return null;
}


//we have a blob of kanji... it could be a word or multiple words, but how do we know?
//we'll have to look at every permutation since we're not to smart. Carve the kanji up
//into substrings.
//
//Because the API we're using searches via the first character and returns all words
//starting with that character, we want a dictionary of start characters to permutations
//so we can pass in the search permutations.
function buildPermutationDic(buffer) {
	var permutationDic = {};

	//Logger.log("buildPermutationDic start, buffer is " + buffer);

	if (buffer !== null && buffer.length < kMinWordLen) {
		return null;
	}

	var start = 0;
	while (start < buffer.length - 1) {
        //skip if it's not kanji since the dictionary can't search for those.
        if(!isKanji(buffer[start])) 
        {
            start++;
            continue;
        }

		permutationDic[buffer[start]] = [];

		for (var minStart = 2;
			(start + minStart) <= buffer.length; ++minStart) {
			permutationDic[buffer[start]].push(buffer.substring(start, (start + minStart)));
		}
		start++;
	}

	//Logger.log("dic is " + JSON.stringify(permutationDic));
	return permutationDic;

	//start = 0
	//minStart = 2

	//ABCDE
	/* 
	What the output should be.
	AB
	ABC
	ABCD
	ABCDE
	BC
	BCD
	BCDE
	CD
	CDE
	DE
  */
}

async function searchPermutationDic(textStr) {
	var wordDic = {};
    var permutationDic = buildPermutationDic(textStr);
    // console.log("permutationDic is " + JSON.stringify(permutationDic));
    if (permutationDic !== null) {
        for (var key in permutationDic) {
            var results = await getJapaneseWords(key, permutationDic[key]);
            if (results != null && results.length > 0) {
                for (var resultIndex = 0; resultIndex < results.length; ++resultIndex) {
                    var result = results[resultIndex];
                    if (wordDic[result.word]) {
                        wordDic[result.word].count += 1;
                    } else {
                        wordDic[result.word] = {
                            "wordInfo": result,
                            "count": 1
                        }
                    }
                }
            }
        }
    }

    return wordDic;
}

/**
 * Look at groupings of kanji and build a list of strings.
 */
async function buildJapaneseWordDic(textStr) {
	var wordDic = {};
	var buffer = "";

	for (let i = 0; i < textStr.length; ++i) {
		var unicodeVal = textStr[i];

		//test if it's a kanji character
		if (isKanji(textStr[i])) {
			buffer += unicodeVal;
		} else if (buffer.length >= kMinWordLen) {
			//handle different word permutations
			var permutationDic = buildPermutationDic(buffer);
			Logger.log("permutationDic is " + JSON.stringify(permutationDic));
			if (permutationDic !== null) {
				for (var key in permutationDic) {
					var results = await getJapaneseWords(key, permutationDic[key]);
					if (results != null && results.length > 0) {
						for (var resultIndex = 0; resultIndex < results.length; ++resultIndex) {
							var result = results[resultIndex];
							if (wordDic[result.word]) {
								wordDic[result.word].count += 1;
							} else {
								wordDic[result.word] = {
									"wordInfo": result,
									"count": 1
								}
							}
						}
					}
				}
			}

			/*
	  //copy the word over
	  var word = (' ' + buffer).slice(1);
	  Logger.log("buffer is " + buffer + ", word is " + word);
	  if(wordDic[word])
	  {
		wordDic[word].count += 1;
	  }
	  else
	  {
		wordDic[word] = {
		  "wordInfo" : getJapaneseWordData(word),
		  "count" : 1
		}
	  }*/

			//clear the buffer ready for the next word.
			buffer = "";
		} else {
			buffer = "";
		}
	}

	return wordDic;
}

//helper function to test if the letter is a valid kanji unicode
function isKanji(val) {
	return (val >= '\u4E00' && val <= '\u9FBF');
}

function isHiragana(val) {
	return (val >= '\u3040' && val <= '\u309F');
}

function isKatakana(val) {
	return (val >= '\u30A0' && val <= '\u30FF');
}

/**
 * Given a text string returns an array of all the unique kanji in a text string.
 * @param textStr Japanese text to process and build a kanji table from.
 * @customfunction
 */
async function buildKanjiTable(textStr) {
	var output = [];
	output.push(["Kanji Table"]);
	output.push(["kanji", "konyomi", "onyomi", "grade", "definition", "count"]);

	var kanjiDic = await buildKanjiTableData(textStr);
	var statDic = {};
	var kanjiCount = 0; //count as we loop
	for (var key in kanjiDic) {
		var kanjiInfo = kanjiDic[key].kanjiInfo;

		//compile some stats based on the grade so I can see where most of the kanji liess.
		var grade = kanjiInfo[2];
		if (!statDic[grade]) {
			statDic[grade] = {
				count: 1
			};
		} else {
			statDic[grade].count++;
		}

		//add the kanji character to the front
		kanjiInfo.unshift(key);
		kanjiInfo.push(kanjiDic[key].count);
		output.push(kanjiInfo);
		kanjiCount++;
	}

	//figure out percentage of kanji for each school grade level.
	output.push([]);
	output.push(['Kanji Grade Stats']);
	// var totalKanjiFound = Object.keys(kanjiDic).length;
	var statKeys = Object.keys(statDic);
	statKeys.sort();
	for (var statIdx = 0; statIdx < statKeys.length; ++statIdx) {
		var key = statKeys[statIdx];
		output.push([key, statDic[key].count, statDic[key].count / kanjiCount]);
	}
	output.push(['Total Kanji', kanjiCount]);

	return output;
}

/**
 * Build the dictionary of unique kanji in the text
 */
async function buildKanjiTableData(textStr) {
	var kanjiDic = {};

	// Kanji unicode: 	\u4E00-\u9FAF
	// Build unique set of kanji characters
	// character order is how it was found in the text.
	for (var i = 0; i < textStr.length; ++i) {
		var unicodeVal = textStr[i];

		//test if it's a kanji character
		if (isKanji(textStr.charCodeAt(i))) {
			//if we have this character, ignore it.
			if (kanjiDic[unicodeVal]) {
				kanjiDic[unicodeVal].count += 1;
			} else {
				kanjiDic[unicodeVal] = {
					kanjiInfo: await getKanjiArray(unicodeVal),
					count: 1
				};
			}
		}
	}

	return kanjiDic;
}



/**
 * Given a text string returns an array of all the unique kanji based vocab words
 * @param textStr Japanese text to process and build a kanji table from.
 * @customfunction
 */
 async function buildJapaneseWordTable_v2(textStr) {
	var output = [];
	output.push(["Vocabulary List"]);

	//get words made out of kanji and print them out.
	var wordDic = await searchPermutationDic(textStr)
	for (var key in wordDic) {
		var wordInfo = wordDic[key].wordInfo;

		if (wordInfo !== null) {
			output.push([key, wordInfo.pronounced, "", "", wordInfo.meanings, wordDic[key].count]);
		} else {
			output.push([key, "none", "", "", "no definition", 0]);
		}
	}

	return output;
}


/**
 * Given a text string returns an array of all the unique kanji based vocab words
 * @param textStr Japanese text to process and build a kanji table from.
 * @customfunction
 */
async function buildJapaneseWordTable(textStr) {
	var output = [];
	output.push(["Vocabulary List"]);

	//get words made out of kanji and print them out.
	var wordDic = await buildJapaneseWordDic(textStr)
	for (var key in wordDic) {
		var wordInfo = wordDic[key].wordInfo;

		if (wordInfo !== null) {
			output.push([key, wordInfo.pronounced, "", "", wordInfo.meanings, wordDic[key].count]);
		} else {
			output.push([key, "none", "", "", "no definition", 0]);
		}
	}

	return output;
}

/**
 * Build kanji and word tables -- but this can exceed the max allowed runtime for a goodgle spreadsheet.
 */
async function BuildJapaneseWorksheet(textStr) {
	var output = [];

	var kanjiDic = await buildKanjiTableData(textStr);
	for (var key in kanjiDic) {
		var kanjiInfo = kanjiDic[key].kanjiInfo;
		//add the kanji character to the front
		kanjiInfo.unshift(key);
		kanjiInfo.push(kanjiDic[key].count);
		output.push(kanjiInfo);
	}

	output.push([]);
	output.push(["Vocabulary List"]);

	//get words made out of kanji and print them out.
	var wordDic = await buildJapaneseWordDic(textStr)
	for (var key in wordDic) {
		var wordInfo = wordDic[key].wordInfo;

		if (wordInfo !== null) {
			output.push([key, wordInfo.pronounced, "", "", wordInfo.meanings, wordDic[key].count]);
		} else {
			output.push([key, "none", "", "", "no definition", 0]);
		}
	}

	return output;
}

function clamp(num, min, max) {
    return Math.min(Math.max(num, min), max);
}

//return a list of Japanese words and their definition and hiragana.
async function BuildJapaneseWords_v2(textStr) {
    var outputDic = {};
    var output = [];
    // output.push(["Vocabulary List"]);

    var clauses = SplitTextIntoClauses(textStr);
    var tasks = [];

    for(let i=0; i<clauses.length; ++i) 
    {
        var words = BuildWordList(clauses[i]);
        for(let j=0; j<words.length; ++j) 
        {
            tasks.push(searchPermutationDic(words[j]));
        }
    }

    var results = await Promise.all(tasks);

    //consolidate all of the results into one dictionary.
    for(let k=0; k<results.length; ++k)
    {
        var result = results[k];
        for (var key in result) {
            var wordInfo = result[key].wordInfo;
    
            if(outputDic[key] == null) 
            {
                outputDic[key] = [key, wordInfo.pronounced, wordInfo.meanings];
            }
        }
    }

    for(var key in outputDic) 
    {
        output.push(outputDic[key]);
    }

    return output;
}


//index is the current index, function will look at the previous one.
function IsPrevCharKanji(index, clauseStr)
{
    //get prev character.
    var clampIndex = clamp(index-1, 0, clauseStr.length);
    //still within bounds.
    if(clampIndex < index) 
    {
        return isKanji(clauseStr[clampIndex]); 
    }
    
    return false;
}

function BuildWordList(clauseStr) {
    //loop through the characters and determine if the character is a kanji character.
    //see if there's a kanji character before it, if so, we've probably taken care of it.
    var buffers = [];

    //outer loop looks at each character to determine if it's the start of a kanji string. 
    for(let i=0; i<clauseStr.length; ++i) 
    {
        // console.log(clauseStr[i] + "isHiragana " + isHiragana(clauseStr[i]) + ", isKanji " + isKanji(clauseStr[i]) + ", isPrevKanji: " + IsPrevCharKanji(i, clauseStr));
        //if this is a kanji character and it doesn't have a previous one, buffer it.
        if(isKanji(clauseStr[i]) && !IsPrevCharKanji(i, clauseStr)) 
        {
            buffers.push(BuildWord(clauseStr, i));
        }
    }
    return buffers;
}

//find an appropriate end index and make a substring.
function BuildWord(clauseStr, startIndex)
{
    var kConsectuiveNonKanjiMax = 2;
    var consecutiveNonKanjiCnt = 0;

    // var buffer = clauseStr[startIndex];
    let endIndex = 0;
    for(endIndex = startIndex + 1; endIndex<clauseStr.length; ++endIndex) 
    {
        //look for terminating cases. Case 1: multiple consecutive non-kanji characters.
        if(!isKanji(clauseStr[endIndex]))
        {
            consecutiveNonKanjiCnt++;
        }

        //case 2: we hit a typical language particle. 
        if(consecutiveNonKanjiCnt > kConsectuiveNonKanjiMax || IsParticle(clauseStr[endIndex])) 
        {
            break;
        }
    }

    return clauseStr.substring(startIndex, endIndex);

    // return buffer;
}

//These aren't all the particles, just the most typical ones used to break up words.
function IsParticle(unicodeChar) 
{
    var particles = ['\u3067', '\u306b', '\u306e', '\u306f', '\u3092']; //で、は、に、の、を
    for(let i=0; i<particles.length; ++i)
    {
        if(particles[i] == unicodeChar)
        {
            return true;
        }
    }

    return false;
}

function SplitTextIntoClauses(textStr) {
    // var strings = textStr.split('\u3001');
    var sentences = textStr.split('\u3002');
    var clauses = [];
    for(let i=0; i<sentences.length; ++i)
    {
        //take each sentence and split it into clauses using the comma.
        var commaSplit = sentences[i].split('\u3001'); //split on the japanese comma.
        for(let j=0; j<commaSplit.length; ++j) 
        {
            if(commaSplit[j].length >= 0) 
            {
                clauses.push(commaSplit[j]);
            }
        }
    }

    return clauses;
}

// module.exports = {
export default {
	getKanjiArray,
	getJapaneseWord,
	buildKanjiTable,
	buildJapaneseWordTable,
	BuildJapaneseWorksheet,
    BuildJapaneseWords_v2
}