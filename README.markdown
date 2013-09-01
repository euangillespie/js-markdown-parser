# js-markdown-parser #

This is a fairly straightforward Javascript parser for [Markdown][], which I wrote for a personal project that never quite came to anything. If you're looking for a practical Markdown parser, something like [markdown-js][] is probably a better bet - this project is not particularly mature or thoroughly tested. It's simplicity may make it useful as a starting point for some other Markdown-based processing, which is mostly why I'm keeping it around.

Note that, because it was only intended for client-side processing, this parser doesn't do the email address mangling that the original Perl implementation does.

## Usage ##

The code/markdownParser.js file contains everything. Include it and pass the markdownParser.parseDocument method a string of Markdown text to get HTML back. That's all there is to it.

## License ##

Released under the MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

[Markdown]: http://daringfireball.net/projects/markdown/
[markdown-js]: https://github.com/evilstreak/markdown-js
