import React from "react";
import color from "color";
import text_file from "./sample_text.txt";

class TextHighlighter extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      text: [],
      selectedText: [],
      textHighlights: []
    };
    this.MAIN_REF = React.createRef();
  }

  componentDidMount() {
    fetch(text_file)
      .then(res => res.text())
      .then(text =>
        this.setState({
          text
        })
      );
  }

  generateRandomColor = () => {
    const letters = "456789ABCD";
    const hexColor =
      "#" +
      Array(6)
        .fill()
        .map(c => letters[Math.floor(Math.random() * letters.length)])
        .join("");

    return hexColor;
  };

  getSelectionCharacterOffset = () => {
    let start = 0;
    let end = 0;
    const selection = window.getSelection();

    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const preCaretRange = range.cloneRange();

      preCaretRange.selectNodeContents(this.MAIN_REF.current);
      preCaretRange.setEnd(range.startContainer, range.startOffset);

      start = preCaretRange.toString().length;
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      end = preCaretRange.toString().length;
    }

    return { start, end };
  };

  findTextSelectionPoints = node => {
    const { textHighlights } = this.state;
    if (!textHighlights || !textHighlights.length) {
      return null;
    }

    const selectionStarts = textHighlights
      .filter(s => s.startIdx >= node.startIdx && s.startIdx < node.endIdx)
      .map(s => ({ startIdx: s.startIdx - node.startIdx, color: s.color }));

    const selectionEnds = textHighlights
      .filter(s => s.endIdx > node.startIdx && s.endIdx <= node.endIdx)
      .map(s => ({ endIdx: s.endIdx - node.startIdx, color: s.color }));

    const wholeSelections = textHighlights
      .filter(s => s.startIdx <= node.startIdx && s.endIdx >= node.endIdx)
      .map(s => ({ startIdx: 0, endIdx: node.endIdx - node.startIdx, color: s.color }));

    return [...selectionStarts, ...selectionEnds, ...wholeSelections];
  };

  handleMouseUp = e => {
    if (!e.altKey) {
      return;
    }

    const selection = window.getSelection();
    const selectionText = selection.toString();
    if (!selectionText || !selectionText.length) {
      return;
    }

    const highlightColor = this.generateRandomColor();
    const selectionOffset = this.getSelectionCharacterOffset();
    const newSelection = {
      selection: selectionText,
      startIdx: selectionOffset.start,
      endIdx: selectionOffset.end,
      color: highlightColor
    };

    const selectedText = [...this.state.selectedText, { ...newSelection }];

    const textHighlights = [];
    const highlightOverlapColor = color(highlightColor).darken(0.2);

    this.state.textHighlights.forEach(h => {
      // Find overlaps between new selection and current highlighted text
      // then break them down accordingly
      const highlight = { ...h };
      const startOverlap = newSelection.startIdx >= h.startIdx && newSelection.startIdx < h.endIdx;
      const endOverlap = newSelection.endIdx >= h.startIdx && newSelection.endIdx < h.endIdx;

      if (startOverlap && !endOverlap) {
        const { startIdx } = newSelection;
        const { endIdx } = highlight;

        highlight.endIdx = startIdx;
        newSelection.startIdx = endIdx;

        textHighlights.push({
          startIdx,
          endIdx,
          color: highlightOverlapColor
        });
      }

      if (endOverlap && !startOverlap) {
        const { startIdx } = highlight;
        const { endIdx } = newSelection;

        highlight.startIdx = endIdx;
        newSelection.endIdx = startIdx;

        textHighlights.push({
          startIdx,
          endIdx,
          color: highlightOverlapColor
        });
      }

      textHighlights.push(highlight);
    });

    textHighlights.push(newSelection);

    this.setState({ selectedText, textHighlights });
    selection.empty();
  };

  renderTextNode = (node, idx) => {
    const selectionPoints = this.findTextSelectionPoints(node);
    if (!selectionPoints || !selectionPoints.length) {
      return <p key={`text-node-${idx}`}>{node.text}</p>;
    }

    const textNode = node.text.split("").reduce((nodes, char, idx) => {
      let currentNodes = [...nodes];

      const selectionStartPoint = selectionPoints.find(s => s.startIdx === idx);
      if (selectionStartPoint) {
        currentNodes.push({ text: char, selectionColor: selectionStartPoint.color });
        return currentNodes;
      }

      const selectionEndPoint = selectionPoints.find(s => s.endIdx === idx);
      if (selectionEndPoint) {
        if (currentNodes.length) {
          currentNodes[currentNodes.length - 1].selectionColor = selectionEndPoint.color;
        }

        currentNodes.push({ text: char });
        return currentNodes;
      }

      if (currentNodes.length) {
        currentNodes[currentNodes.length - 1].text += char;
      } else {
        currentNodes.push({ text: char });
      }

      return currentNodes;
    }, []);

    return (
      <p key={`text-node-${idx}`}>
        {textNode.map(n =>
          n.selectionColor ? <span style={{ backgroundColor: n.selectionColor }}>{n.text}</span> : n.text
        )}
      </p>
    );
  };

  renderText() {
    const { text } = this.state;
    if (!text || !text.length) {
      return null;
    }

    const textNodes = text
      .split(/\r?\n/)
      .filter(a => a !== "")
      .reduce((acc, text, idx) => {
        let startIdx = acc.length ? acc[idx - 1].endIdx : 0;
        let endIdx = startIdx + text.length;
        return [
          ...acc,
          {
            text,
            startIdx,
            endIdx,
            length: text.length
          }
        ];
      }, []);

    return textNodes.map((n, idx) => this.renderTextNode(n, idx));
  }

  render() {
    return (
      <div className="text-highlighter" ref={this.MAIN_REF}>
        <div className="text-highlighter-text" onMouseUp={this.handleMouseUp}>
          {this.renderText()}
        </div>
        <div className="text-highlighter-selections">
          <h3>Current Selections</h3>
          <span>(hold ALT key to select text)</span>
          {this.state.selectedText.length ? (
            this.state.selectedText
              .sort((a, b) => a.startIdx - b.startIdx)
              .map(t => (
                <div className="highlighted-selection">
                  <div style={{ backgroundColor: t.color }}>{t.selection}</div>
                </div>
              ))
          ) : (
            <h5>No text selected.</h5>
          )}
        </div>
      </div>
    );
  }
}

export default TextHighlighter;
