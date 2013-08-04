markdown = (function(){
	var md = {};

	md.parse = function(text){
		text = this.readReferences(text);
		this.remainingInput = text.split('\n');
		this.currentLine = this.remainingInput.shift();
		this.output = '';
		while (typeof(this.currentLine) !== 'undefined'){
			this.processBlock();
		}
		return this.output;
	}

	md.processLine = function(escapeInlineHTML){
		if (typeof escapeInlineHTML === 'undefined'){
			escapeInlineHTML = false;
		}
		var line = this.currentLine
		line = this.htmlEscape(line, escapeInlineHTML);
		line = this.doInlineSubstitutions(line);
		line = this.replaceLinks(line);
		line = this.markDownEscape(line);
		this.output += line;
		this.popLine();
	}


	md.popLine = function(){
		this.currentLine = this.remainingInput.shift();
	}

	md.readReferences = function(text){
		// DOES NOT HANDLE <s around URLs, or titles on next line
		this.references = {};
		//0-3 spaces, [name]:, 1-3 spaces, url (anything except spaces and ",',( ),
		// an optional title in ", ' or (s, then optional whitespace
		var referenceRe = /^(?:[ ]{0,3})\[([^\]]+)\]:[ ]{1,3}([^ "'(\n\r]+)(?:\s+["'(]([^"')]+)["')])?\s*$/gm;
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

	md.escapeChars = [
		['\\', new RegExp('[\\\\]', 'g')],
		['`', new RegExp('\\`', 'g')],
		['*', new RegExp('\\\\\\*', 'g')],
		['_', new RegExp('\\_', 'g')],
		['{', new RegExp('\\\\\\{', 'g')],
		['[', new RegExp('\\\\\\[', 'g')],
		['(', new RegExp('\\\\\\(', 'g')],
		['#', new RegExp('\\#', 'g')],
		['+', new RegExp('\\\\\\+', 'g')],
		['-', new RegExp('\\-', 'g')],
		['.', new RegExp('\\\\\\.', 'g')],
		['!', new RegExp('\\!', 'g')],
	]

	md.markDownEscape = function(text){
		var escapeData;
		for (var i = 0; i < this.escapeChars.length; i++){
			escapeData = this.escapeChars[i];
			text = text.replace(escapeData[1], escapeData[0]);
		}
		return text;
	}

	md.htmlEscape = function(text, escapeInlineHTML){
		var htmlTagPositions;
		// Replace & with &amp;, except in HTML entities
		text = text.replace(/&.{0,7}/g, function(match){
			if (match.match(/^&.{1,6};/)){
				return match;
			} else {
				return '&amp;'
			}
		});
		// Replace < and > with &lt; and &gt;, but skip inline html unless
		// escapeInlineHTML is true
		if (escapeInlineHTML){
			text = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
		} else {
			text = text.replace(/<.?/g, function(match, offset){
				if (match.match(/^<[a-zA-Z\/]/)){
					return match;
				} else {
					return '&lt;';
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

	md.doInlineSubstitution = function(line, character, tag){
		var openingTag = '<%s>'.replace('%s', tag);
		var closingTag = '</%s>'.replace('%s', tag);
		character = character.replace(/./g, function(character){ return '[' + character + ']'; });
		// * at start of line or in middle of line but not after backslash
		var openingCharacter = '(?:^%c)|(?:[^\\\\]%c)'.replace(/%c/g, character);
		// * that isn't after backslash or space
		var closingCharacter = '(?:[^\\\\ ])%s'.replace('%s', character);;
		// optional body (char that isn't space + some arbitary chars), then char that isn't space or backslash and character
		var bodyAndClosingChar = '([^ ].*?)?([^\\\\ ]%c)'.replace('%c', character)
		var charRegexp = new RegExp('(%o)(?:%b)(.{0,1})'.replace('%o', openingCharacter).replace('%b', bodyAndClosingChar), 'g');
		return line.replace(charRegexp, function(match, startChars, middle, endChars, after){
			startChars = startChars.length > 1 ? startChars[0] : '';
			endChars = endChars.length > 1 ? endChars[0] : '';
			return startChars + openingTag + middle + endChars + closingTag + after;
		});
	}

	md.doInlineSubstitutions = function(line){
		for (var replacement in this.inlineReplacements){
			if (this.inlineReplacements.hasOwnProperty(replacement)){
				line = this.doInlineSubstitution(line, replacement, this.inlineReplacements[replacement]);
			}
		}
		return line;
	}

	md.replaceLinks = function(line){
		// [an example](http://example.com/ "optional title")
		var inlineLink = /\[([^\]]+)\]\(([^ "(]+)(?:\s+["]([^"]+)["])\)/g;
		line = line.replace(inlineLink, function(match, text, url, title){
			title = title ? ' title="' + title + '"' : '';
			return '<a href="' + url + '"' + title + '>' + text + '</a>';
		});

		// [an example][optional id]
		var referenceLink = /\[([^\]]+)\][ ]?\[([^\]]*)\]/g;
		line = line.replace(referenceLink, function(match, text, id){
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
			return '<a href="' + reference.url + '"' + title + '>' + text + '</a>';
		});
		return line;
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
