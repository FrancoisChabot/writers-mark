import { Options } from './options';
import { Style } from './style';

type Block = (string | SpanSection)[];

interface SpanSection {
  contents: Block;
  style: string;
}

interface Paragraph {
  contents: Block;
  style?: string;
}

export interface AST {
  paragraphs: Paragraph[];
}

const applySpanStyles = (data: string, style: Style): Block => {
  let rule: string = '';
  let start = data.length;
  let payloadStart = data.length;
  let end = data.length;
  let postEnd = data.length;
  for (const k of Object.keys(style.span)) {
    const startMatch = data.indexOf(k);
    if (startMatch === -1 || startMatch > start || (startMatch === start && k.length < rule.length)) {
      continue;
    }

    const payloadStartMatch = startMatch + k.length;
    const endPattern = style.span[k].endPattern || k;
    const endMatch = data.indexOf(endPattern, payloadStartMatch);
    if (endMatch === -1) {
      continue;
    }

    rule = k;
    start = startMatch;
    payloadStart = payloadStartMatch;
    end = endMatch;
    postEnd = end + endPattern.length;
  }

  if (rule !== '') {
    const prefix = data.substr(0, start);
    const current = {
      contents: applySpanStyles(data.substr(payloadStart, end - payloadStart), style),
      style: rule,
    };
    const postfixStr = data.substr(postEnd);

    const postfixArray = postfixStr.length > 0 ? applySpanStyles(data.substr(postEnd), style) : [];
    const prefixArray = prefix.length > 0 ? [prefix] : [];

    return [...prefixArray, current, ...postfixArray];
  } else {
    return [data];
  }
};

/** Checks that an ast is validly usable with the provided style
 * @param ast The ast to validate.
 * @param style The style to apply.
 */
export const isValid = (ast: AST, style: Style): boolean => {
  const blockIsValid = (block: Block): boolean => {
    for (const s of block) {
      const asSection = s as SpanSection;

      if (asSection.contents && asSection.style) {
        if (!style.span[asSection.style] || !blockIsValid(asSection.contents)) {
          return false;
        }
      }
    }
    return true;
  };

  for (const p of ast.paragraphs) {
    if (p.style) {
      if (!style.paragraph[p.style]) {
        return false;
      }
    }

    if (!blockIsValid(p.contents)) {
      return false;
    }
  }
  return true;
};

/** Compiles a raw string into an AST according to a given style
 * @param data The raw string to interpret.
 * @param style The style to apply.
 */
export const compile = (data: string, style: Style, options?: Options): AST => {
  const lines = data.split('\n');
  const paragraphs: Paragraph[] = [];

  let currentTxt: string = '';
  let currentStyle: string = '';
  let starting: boolean = true;

  const commitParagraph = () => {
    if (currentTxt !== '') {
      paragraphs.push({
        contents: applySpanStyles(currentTxt, style),
        style: currentStyle,
      });
    }

    currentTxt = '';
    currentStyle = '';
    starting = true;
  };

  for (let line of lines) {
    line = line.trim();
    if (line === '') {
      commitParagraph();
    } else {
      if (starting && style.paragraph[line]) {
        currentStyle = line;
      } else {
        if (currentTxt !== '') {
          currentTxt += ' ';
        }
        currentTxt += line;
      }
      starting = false;
    }
  }

  commitParagraph();

  return { paragraphs };
};
