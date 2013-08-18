markdown = (function(){
	var md = {};

	md.parseDocument = function(text){
		text = this.readReferences(text);
		return this.parseText(text);
	}

	md.parseText = function(text){
		// Strip insignificant initial whitespace
		text = text.replace(/^[ ]{1,3}(\S)/gm, function(match, nextChar){
			return nextChar;
		});
		text = this.replaceLineBreaks(text);
		text = this.replaceCode(text);
		text = this.replaceLists(text);
		text = this.replaceBlockQuotes(text);
		text = this.replaceCodeBlocks(text);
		text = this.replaceHeadings(text);
		text = this.replaceRules(text);
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
			if (firstChar === '\\'){
				return match;
			} else {
				return firstChar + '\\' + escapeChar;
			}
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
				// Code blocks can't contain empty lines - ignore this match if it does
				if (!match.match(/\n\s*\n/)){
					match = this.htmlEscape(match, true);
					console.log('a' + match + 'a');
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
		// Blocks with -/+/* at start of each line or paragraph
		var unorderedList = /(?:^[\-+*]\s+.*(?:\n|$))(?:^(?:(?:[\-+*]\s+.*)|(?:.+))(?:\n|$))*/gm;
		text = text.replace(unorderedList, function(match){
			// Replace list markers with <li>s
			match = match.replace(/^[\-+*]([^\-+*]*)(?:\n|$)/gm, function(match, content){
				return '<li>' + md.parseText(content) + '</li>';
			});
			// Recursively parse contents of the list
			return '<ul>' + match + '</ul>';
		});

		// Blocks with a number, followed by ., at the start of each line or paragraph
		var orderedList = /(?:^\d+[.]\s+.*(?:\n|$))(?:^(?:(?:\d+[.]\s+.*)|(?:.+))(?:\n|$))*/gm;
		text = text.replace(orderedList, function(match){
			// Replace list markers with <li>s
			// This checks for an opening list marker, any amount of content, and then a closing marker, end of input or empty line
			match = match.replace(/^\d+.\s+([\s\S]*?)(?:(?:\d+.\s+)|(?:^\n)|$)/gm, function(match, content){
				return '<li>' + md.parseText(content) + '</li>';
			});
			// Recursively parse contents of the list
			return '<ol>' + match + '</ol>';
		});
		return text;
	}

	md.replaceBlockQuotes = function(text){
		// Blocks with > at start of each line or paragraph
		var blockQuote = /(?:^>.*\n?)(?:^(?:(?:>.*)|(.+))\n?)*/gm;
		text = text.replace(blockQuote, function(match){
			// Strip initial >
			match = match.replace(/^>/gm, '');
			// Recursively parse contents of the blockquote
			match = md.parseText(match);
			return '<blockquote>' + match + '</blockquote>';
		});
		return text;
	}

	md.replaceCodeBlocks = function(text){
		// Anything indented by 4 or more spaces or 1 tab
		var codeBlock = /(?:^(?:[ ]{4}|\t).*\n?)+/gm;
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

	md.replaceParagraphs = function(text){
		// Wrap <p>s around blocks of text, with spaces or lines of HTML in between
		// This should be used after other block-level elements have been expanded, and
		// before inline elements. Any escapeable HTML should have been escaped
		// by this point.
		var paragraph = /(?:^[^<\s].*(?:\n|$))+/gm;
		text = text.replace(paragraph, function(match){
			if (match[match.length-1] === '\n'){
				match = match.slice(0, -1);
			}
			return '<p>' + match + '</p>';
		});
		return text;
	}

	return md;
})();
