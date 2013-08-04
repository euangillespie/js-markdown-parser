markdown = (function(){
	var md = {};

	md.parse = function(text){
		text = this.readReferences(text);
		text = this.htmlEscape(text);
		text = this.doInlineSubstitutions(text);
		text = this.replaceLinks(text);
		text = this.markDownEscape(text);
		this.remainingInput = text.split('\n');
		this.currentLine = this.remainingInput.shift();
		this.output = '';
		while (typeof(this.currentLine) !== 'undefined'){
			this.processBlock();
		}
		return this.output;
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


	md.getBlockProcessor = function(){
		if (typeof(this.currentLine) === 'undefined'){
			return md.blockProcessors.COMPLETE;
		} else {
			var trimmedLine = this.currentLine.trimLeft();
		}
		if (trimmedLine === ''){
			return md.blockProcessors.BLANK;
//		} else if (trimmedLine.slice(0, 2).match(/^[-,*,+] .*/)){
//			return md.blockProcessors.UNORDERED_LIST;
//		} else if (trimmedLine.slice(0, 2).match(/^\d+\..*/)){
//			return md.blockProcessors.ORDERED_LIST;
		} else {
			return md.blockProcessors.PARAGRAPH;
		}
	}


	md.processBlock = function(){
		var processor = this.getBlockProcessor();
		processor();
	}

	md.processBlank = function(){
		this.popLine();
	}


	md.processLine = function(){
		this.output += this.currentLine;
		this.popLine();
	}


	md.markupBlock = function(blockType, blockTag){
		var line;
		var lineType;
		this.output += '<' + blockTag + '>';
		while (typeof(lineType) === 'undefined' || lineType === blockType){
			this.processLine();
			lineType = this.getBlockProcessor();
		}
		this.output += '</' + blockTag + '>';
	}

	md.processParagraph = function(){
		this.markupBlock(md.blockProcessors.PARAGRAPH, 'p');
	}

	md.blockProcessors = {
		COMPLETE: function(){},
		BLANK: function(){ md.processBlank(); },
		PARAGRAPH: function(){ md.processParagraph(); },
	}

	return md;
})();
