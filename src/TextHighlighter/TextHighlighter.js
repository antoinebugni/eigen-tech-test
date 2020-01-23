import React from "react";
import color from "color";
import text_file from "../sample_text.txt";
import "./TextHighlighter.css";

class TextHighlighter extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      text: [],
      selectedText: [],
      textHighlights: []
    };
    this.ROOT_NODE_REF = React.createRef();
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
    //  Returns the start and end offset within the main node
    // for the current selection
    let start = 0;
    let end = 0;
    const selection = window.getSelection();

    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rangeClone = range.cloneRange();

      rangeClone.selectNodeContents(this.ROOT_NODE_REF.current);
      rangeClone.setEnd(range.startContainer, range.startOffset);

      start = rangeClone.toString().length;
      rangeClone.setEnd(range.endContainer, range.endOffset);
      end = rangeClone.toString().length;
    }

    return { start, end };
  };

  findTextnodeSelectionPoints = node => {
    // Returns a list of all points within the given text node
    // where a selection starts or ends, with the relevant selection color

    const { textHighlights } = this.state;
    if (!textHighlights || !textHighlights.length) {
      return [];
    }
    const nodeLength = node.text.length;

    const nodeSelectionPoints = textHighlights
      // find all highlights that start or end within this text node
      .filter(
        s =>
          (s.startIdx >= node.startIdx && s.startIdx < node.endIdx) ||
          (s.endIdx > node.startIdx && s.endIdx <= node.endIdx)
      )
      .map(s => ({
        startIdx: s.startIdx - node.startIdx < 0 ? 0 : s.startIdx - node.startIdx,
        endIdx: s.endIdx - node.startIdx > nodeLength ? nodeLength : s.endIdx - node.startIdx,
        color: s.color
      }));

    const wholeNodeSelections = textHighlights
      // find all highlights that cover this entire text node
      .filter(s => s.startIdx <= node.startIdx && s.endIdx >= node.endIdx)
      .map(s => ({
        startIdx: 0,
        endIdx: nodeLength,
        color: s.color
      }));

    return [...nodeSelectionPoints, ...wholeNodeSelections];
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
    const nodeSelectionPoints = this.findTextnodeSelectionPoints(node);
    if (!nodeSelectionPoints || !nodeSelectionPoints.length) {
      return <p key={`text-node-${idx}`}>{node.text}</p>;
    }

    const textNode = node.text.split("").reduce(
      (textSegments, char, idx) => {
        let segments = [...textSegments];
        const currentSegment = segments[segments.length - 1];

        const sel = nodeSelectionPoints
          .filter(s => s.startIdx <= idx && s.endIdx > idx)
          .sort((a, b) => a.startIdx - b.startIdx);
        const selection = sel.length && sel[sel.length - 1];

        const newSegmentColor = selection && selection.color !== currentSegment.color;
        if (newSegmentColor) {
          // start a new segment with a different colour
          segments.push({
            text: char,
            color: selection.color
          });
          return segments;
        }

        const isSameSegment =
          (selection && selection.color === currentSegment.color) || (!selection && !currentSegment.color);

        if (isSameSegment) {
          // add a character to the current segment
          currentSegment.text += char;
          return segments;
        }

        segments.push({ text: char });
        return segments;
      },
      [{ text: "" }]
    );

    return (
      <p key={`text-node-${idx}`}>
        {textNode.map(n => (n.color ? <span style={{ backgroundColor: n.color }}>{n.text}</span> : n.text))}
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

    return (
      <div className="text-highlighter-text" onMouseUp={this.handleMouseUp}>
        {textNodes.map((n, idx) => this.renderTextNode(n, idx))}
      </div>
    );
  }

  renderSelections() {
    return (
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
    );
  }

  render() {
    return (
      <div className="text-highlighter" ref={this.ROOT_NODE_REF}>
        {this.renderText()}
        {this.renderSelections()}
      </div>
    );
  }
}

export default TextHighlighter;
