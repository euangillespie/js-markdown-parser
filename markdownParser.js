markdownParser = (function(){
	var md = {};

	md.parseDocument = function(text){
		text = this.readReferences(text);
		return this.parseText(text);
	}

	md.parseText = function(text){
		text = this.replaceHeadings(text);
		// Strip insignificant initial whitespace
		text = text.replace(/^[ ]{1,3}(\S)/gm, function(match, nextChar){
			return nextChar;
		});
		text = this.replaceRules(text);
		if (text[text.length-1] == '\n'){
			text = text.slice(0, -1);
		}
		text = this.replaceLineBreaks(text);
		text = this.replaceLists(text);
		text = this.replaceCodeBlocks(text);
		text = this.replaceCode(text);
		text = this.replaceBlockQuotes(text);
		text = this.htmlEscape(text);
		text = this.doInlineSubstitutions(text);
		text = this.replaceParagraphs(text);
		text = this.replaceLinks(text);
		text = this.markDownEscape(text);
		return text;
	}

	md.popLine = function(){
		this.currentLine = this.remainingInput.shift();
	}

	md.readReferences = function(text){
		this.references = {};
		//0-3 spaces, [name]:, 1-3 spaces, url (anything except spaces and ",',(, )s, possible with < and > around)
		// an optional title in ", ' or (s, then optional whitespace
		var referenceRe = /^(?:[ ]{0,3})\[([^\]]+)\]:[ ]{1,3}<?([^ "'(\n\r]+?)>?(?:\s+["'(]([^"')]+)["')])?\s*$/gm;
		text = text.replace(referenceRe, function(match, name, url, title){
			title = title ? title.trim().toLowerCase() : undefined;
			md.references[name] = {
				'url': url,
				'title': title
			};
			return '';
		});
		return text;
	}

	///////////////////////// Escaping

	md.escapeableChars = '[\\\\`*_(){}\\[\\]#+-.!]';

	md.escapeText = function(text){
		// Replace all escape-able characters with their escapes (unless they're escaped already)
		return text.replace(new RegExp('(.?)(' + this.escapeableChars + ')', 'g'), function(match, firstChar, escapeChar){
			return firstChar + '\\' + escapeChar;
		});
	}

	md.markDownEscape = function(text){
		// Replace escape sequences with their characters (eg \\ -> \, \* -> *)
		return text.replace(new RegExp('\\\\' + this.escapeableChars, 'g'), function(match){
			return match.slice(1);
		});
	}

	md.htmlEscape = function(text, escapeInlineHTML){
		var htmlTagPositions;
		// Replace & with &amp;, except in HTML entities
		text = text.replace(/&.{0,7}/g, function(match){
			if (match.match(/^&.{1,6};/)){
				return match;
			} else {
				return '&amp;' + match.slice(1);
			}
		});
		if (escapeInlineHTML){
			text = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
		} else {
			text = text.replace(/<[\s\S]?/g, function(match, offset){
				if (match.match(/^<[a-zA-Z\/]/)){
					return match;
				} else {
					return '&lt;' + match.slice(1);
				}
			});
		}
		return text;
	}

	//////////////////////////////////////// Inline elements

	md.inlineReplacements = {
		'**': 'strong',
		'__': 'strong',
		'*': 'em',
		'_': 'em',
	}

	md.doInlineSubstitution = function(text, character, tag){
		var openingTag = '<%s>'.replace('%s', tag);
		var closingTag = '</%s>'.replace('%s', tag);
		character = character.replace(/./g, function(character){ return '[' + character + ']'; });
		// * at start of text or in middle of text but not after backslash
		var openingCharacter = '(?:^%c)|(?:[^\\\\]%c)'.replace(/%c/g, character);
		// * that isn't after backslash or space
		var closingCharacter = '(?:[^\\\\ ])%s'.replace('%s', character);;
		// optional body (char that isn't space + some arbitary chars), then char that isn't space or backslash and character
		// [\s\S] matches any character, including newlines
		var bodyAndClosingChar = '([^ ][\\S\\s]*?)?([^\\\\ ]%c)'.replace('%c', character)
		var charRegexp = new RegExp('(%o)(?:%b)(.{0,1})'.replace('%o', openingCharacter).replace('%b', bodyAndClosingChar), 'g');
		return text.replace(charRegexp, function(match, startChars, middle, endChars, after){
			startChars = startChars.length > 1 ? startChars[0] : '';
			endChars = endChars.length > 1 ? endChars[0] : '';
			middle = middle || '';
			return startChars + openingTag + middle + endChars + closingTag + after;
		});
	}

	md.replaceCode = function(text){

		// One or more backticks, not preceded by a backslash, optionally followed by spaces
		var codeOpening = /(?:^|[^\\])(`+)/g;
		var codeClosing;
		var matchStart = codeOpening.exec(text);
		var matchEnd;
		var tickCount;
		// As the (arbitrary) number of opening backticks must match the closing number,
		// one RegExp replace won't do it. We need to first find opening backticks, then
		// search for a closing set once we know what size to look for.
		while (matchStart){
			// The same number of backticks as opened the code block
			tickCount = matchStart[1].length;
			codeClosing = new RegExp('`{' + tickCount + '}', 'g');
			codeClosing.lastIndex = codeOpening.lastIndex;
			matchEnd = codeClosing.exec(text);
			if (matchEnd){
				match = text.slice(codeOpening.lastIndex, codeClosing.lastIndex - tickCount).trim();
				match = md.escapeText(match);
				match = md.htmlEscape(match, true);
				// Code blocks can't contain empty lines - ignore this match if it does
				if (!match.match(/\n\s*\n/)){
					match = this.htmlEscape(match, true);
					match = '<code>' + match + '</code>';
					text = text.slice(0, codeOpening.lastIndex - tickCount) + match + text.slice(codeClosing.lastIndex);
					codeOpening.lastIndex = codeOpening.lastIndex - tickCount + match.length;
				}
			}
			matchStart = codeOpening.exec(text);
		}
		return text;
	}

	md.doInlineSubstitutions = function(text){
		for (var replacement in this.inlineReplacements){
			if (this.inlineReplacements.hasOwnProperty(replacement)){
				text = this.doInlineSubstitution(text, replacement, this.inlineReplacements[replacement]);
			}
		}
		return text;
	}

	md.replaceLinks = function(text){
		// [an example](http://example.com/ "optional title")
		var inlineLink = /(!?)\[([^\]]+)\]\(([^ "(]+)(?:\s+["]([^"]+)["])?\)/g;
		text = text.replace(inlineLink, function(match, isImage, text, url, title){
			title = title ? ' title="' + title + '"' : '';
			if (isImage){
				return '<img src="' + url + '" alt="' + text + '"' + title + '></img>'
			} else {
				return '<a href="' + url + '"' + title + '>' + text + '</a>';
			}
		});

		// [an example][optional id]
		var referenceLink = /(!?)\[([^\]]+)\][ ]?\[([^\]]*)\]/g;
		text = text.replace(referenceLink, function(match, isImage, text, id){
			var reference;
			var title;
			if (id === ''){
				id = text;
			}
			reference = md.references[id];
			if (typeof reference === 'undefined'){
				return match;
			}
			title = reference.title ? ' title="' + reference.title + '"' : '';
			if (isImage){
				return '<img src="' + reference.url + '" alt="' + text + +'"' + title + '></img>'
			} else {
				return '<a href="' + reference.url + '"' + title + '>' + text + '</a>';
			}
		});

		// <http://www.example.com>
		var autoLink = /<([a-zA-Z0-9]+:\/\/[^>< ]*)>/g;
		text = text.replace(autoLink, function(match, url){
			return '<a href="' + url + '">' + url + '</a>';
		});
		// <euan@example.com>
		var emailLink = /<([^@ ]+@[^>. ]+\.[^>< ]+)>/g;
		text = text.replace(emailLink, function(match, url){
			return '<a href="mailto:' + url + '">' + url + '</a>';
		});

		return text;
	}


///////////////////////////////////////////////// Block elements

	md.replaceLineBreaks = function(text){
		return text.replace(/[ ]{2}[ ]*\n/g, '<br/>\n');
	}

	md.replaceLists = function(text){
		var handleList = function(listTag, listRe, listElementOpeningRe){
			listElementOpeningRe.lastIndex = 0;
			// First, find all occurrences of a full list in the text
			return text.replace(listRe, function(fullList){
				// Reset opening re position, as we're re-using it
				listElementOpeningRe.lastIndex = 0;
				var result = '';
				var lastItemContentWasBlock = false;
				var hasEndingNewLine;
				var content;
				var match = listElementOpeningRe.exec(fullList);
				var currentLiContentStart = listElementOpeningRe.lastIndex;
				var nextMatch = listElementOpeningRe.exec(fullList);
				var nextLiStart = nextMatch ? nextMatch.index : fullList.length;
				// Then, search for each li within each result
				while (match){
					content = fullList.slice(currentLiContentStart, nextLiStart);
					hasEndingNewLine = content.match(/\n\s*\n$/);
					content = content.trimRight();
					// Remove a single leading tab or up to 4 leading spaces, as they is taken as a hanging indent
					content = content.replace(/^(?:\t|(?:\s{1,4}))/gm, '');
					// We'll parse the content of the <li> at the block level (eg, with surrounding <p>s)
					// if there's an empty line at the end of it, or if the last one was block level. However, don't
					// let the last element (or the only element) be block level unless the previous one was.
					if (lastItemContentWasBlock || (hasEndingNewLine && nextMatch)){
						result += '<li>' + md.parseText(content) + '</li>';
					} else {
						result += md.parseText('<li>' + content + '</li>');
					}
					lastItemContentWasBlock = hasEndingNewLine;
					match = nextMatch;
					currentLiContentStart = listElementOpeningRe.lastIndex;
					nextMatch = listElementOpeningRe.exec(fullList);
					nextLiStart = nextMatch ? nextMatch.index : fullList.length;
				}
				return '<' + listTag + '>' + result + '</' + listTag + '>';
			});
		}

		var unorderedList = /(?:(?:^[\-+*]\s+.*(?:\n|$))(?:^(?:.+)(?:\n|$))*(?:^(\n|$))*)+/gm;
		var unorderedListElementStart = /^[\-+*]/gm;
		text = handleList('ul', unorderedList, unorderedListElementStart);

		var orderedList = /(?:(?:^\d+[.]\s+.*(?:\n|$))(?:^(?:.+)(?:\n|$))*(?:^(\n|$))*)+/gm;
		var orderedListElementStart = /^\d+[.]/gm;
		text = handleList('ol', orderedList, orderedListElementStart);
		return text;
	}

	md.replaceBlockQuotes = function(text){
		// Blocks indented with a >, followed by a paragraph and some empty lines
		var blockQuote = /(?:(?:^>.*\n?)(?:^.+\n?)*(?:^\s\n?)*)+/gm;
		text = text.replace(blockQuote, function(match){
			// Strip initial > and insignificant whitespace
			match = match.replace(/^>?(?: {0,3}(\S))?/gm, function(match, nextChar){
				return nextChar || '';
			});
			// Recursively parse contents of the blockquote
			match = md.parseText(match);
			return '<blockquote>' + match + '</blockquote>';
		});
		return text;
	}

	md.replaceCodeBlocks = function(text){
		// Anything indented by 4 or more spaces or 1 tab
		var codeBlock = /(?:^(?:[ ]{4}|\t).*)(?:\n^(?:(?:(?:[ ]{4}|\t).*)|(?:\s*)))*(?:\n|$)/gm;
		text = text.replace(codeBlock, function(match){
			// Strip indent
			match = match.replace(/^(?:\t|[ ]{4})/gm, '');
			match = md.escapeText(match);
			match = md.htmlEscape(match, true);
			return '<pre><code>' + match + '</code></pre>';
		});
		return text;
	}

	md.replaceHeadings = function(text){
		// heading
		// -------
		var setextHeading1 = /^(.*)\n[=]+$/gm;
		text = text.replace(setextHeading1, function(match, content){
			return '<h1>' + content.trim() + '</h1>';
		});
		var setextHeading2 = /^(.*)\n[-]+$/gm;
		text = text.replace(setextHeading2, function(match, content){
			return '<h2>' + content.trim() + '</h2>';
		});


		// ###heading###
		var atxHeading = /^(#+)(.*?)#*$/gm;
		text = text.replace(atxHeading, function(match, opening, content){
			var tag = 'h' + (Math.min(opening.length, 6)).toString();
			return '<' + tag + '>' + content.trim() + '</' + tag + '>';
		});

		return text;
	}

	md.replaceRules = function(text){
		// --------, _________ or ****** (with possible spaces)
		var rules = [
			/^[-][- ]+$/gm,
			/^[_][_ ]+$/gm,
			/^[*][* ]+$/gm
		];
		var doRuleReplacement = function(match){
			match = match.replace(' ', '');
			if (match.length >= 3){
				return '<hr/>';
			} else {
				return match;
			}
		};
		for (var i = 0; i < rules.length; i++){
			(function(rule){
				text = text.replace(rule, doRuleReplacement);
			})(rules[i]);
		}
		return text;
	}

	md.htmlBlockLevelElements = [
		'^<blockquote(?: .*?)?>',
		'^<div(?: .*?)?>',
		'^<dl(?: .*?)?>',
		'^<fieldset(?: .*?)?>',
		'^<form(?: .*?)?>',
		'^<h1(?: .*?)?>',
		'^<h2(?: .*?)?>',
		'^<h3(?: .*?)?>',
		'^<h4(?: .*?)?>',
		'^<h5(?: .*?)?>',
		'^<h6(?: .*?)?>',
		'^<hr(?: .*?)?>',
		'^<li(?: .*?)?>',
		'^<ol(?: .*?)?>',
		'^<p(?: .*?)?>',
		'^<pre(?: .*?)?>',
		'^<table(?: .*?)?>',
		'^<ul(?: .*?)?>'
	];

	md.replaceParagraphs = function(text){
		// Wrap <p>s around blocks of text, with spaces or lines of HTML in between
		// This should be used after other block-level elements have been expanded, and
		// before inline elements. Any escapeable HTML should have been escaped
		// by this point.

		var emptyLine = '(?:^\\s*(?:\\n|$))';
		var blockLevelElement = this.htmlBlockLevelElements.join('|');
		var paragraphEnd = new RegExp(emptyLine + '|(' + blockLevelElement + ')', 'gm');
		var lineStart = /^/gm;

		// Because paragraphs can end at any block level HTML element, but will accept inline ones
		// a simple replace won't suffice. Instead, repeatedly look for paragraph end points and make
		// everything up to them a paragraph
		var lastParagraphEnd = 0;
		var match;
		var matchLength;
		var matchCause;
		var nextParagraphEnd;
		var paragraphText;
		var end;
		while (lastParagraphEnd < text.length){
			match = paragraphEnd.exec(text);
			if (match){
				nextParagraphEnd = match.index;
				matchLength = match[0].length;
				if (match[1]){
					// Caused by HTML tag -> matchCause = tag name
					matchCause = match[1].slice(1, match[1].indexOf(' '));
				} else {
					matchCause = ''
				}
			} else {
				nextParagraphEnd = text.length;
				matchLength = 0;
				matchCause = '';
			}
			/// Pull out everything until the next paragraph end, surround with <p></p>
			if (nextParagraphEnd !== lastParagraphEnd){
				paragraphText = text.slice(lastParagraphEnd, nextParagraphEnd).trimLeft();
				if (paragraphText){
					if (paragraphText[paragraphText.length - 1] === '\n'){
						paragraphText = paragraphText.slice(0, -1);
						nextParagraphEnd -= 1;
					}
					paragraphText = '<p>' + paragraphText + '</p>';
					text = text.slice(0, lastParagraphEnd) + paragraphText + text.slice(nextParagraphEnd);
					nextParagraphEnd = lastParagraphEnd + paragraphText.length + matchLength;
				}
			}
			////// Go to the start of the next paragraph
			if (matchCause === ''){
				// Empty line - go to next line
				paragraphStart = /^/m;
				nextParagraphEnd += 1;
			} else if (matchCause){
				// HTML block level element - go just after it closes
				paragraphStart = new RegExp('</' + matchCause + '>', 'g');
			}
			paragraphStart.lastIndex = nextParagraphEnd;
			if (paragraphStart.exec(text) !== null){
				paragraphEnd.lastIndex = paragraphStart.lastIndex;
				lastParagraphEnd = paragraphEnd.lastIndex;
			} else {
				break;
			}
		}
		return text;
	}

	return md;
})();
