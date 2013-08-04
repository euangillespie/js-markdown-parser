markdown = (function(){
	var md = {};

	md.parse = function(text){
		text = this.readReferences(text);
		text = this.replaceHeadings(text);
		text = this.replaceRules(text);
		text = this.doInlineSubstitutions(text);
		text = this.replaceLinks(text);
		text = this.htmlEscape(text);
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

	md.markDownEscape = function(text){
		return text.replace(/\\[\\`*_(){}\[\]#+-.!]/g, function(match){
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
		// Replace < and > with &lt; and &gt;, but skip inline html unless
		// escapeInlineHTML is true
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
		'`': 'code',
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

	return md;
})();
