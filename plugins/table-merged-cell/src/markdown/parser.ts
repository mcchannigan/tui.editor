import type { CustomParserMap } from '@toast-ui/toastmark';
import { MergedTableCell, MergedTableRow, SpanInfo, SpanType } from '@t/markdown';

function getSpanInfo(content: string, type: SpanType, oppositeType: SpanType): SpanInfo {
  const reSpan = new RegExp(`^((?:${oppositeType}=[0-9]+:)?)${type}=([0-9]+):(.*)`);
  const parsed = reSpan.exec(content);
  let spanCount = 1;

  if (parsed) {
    spanCount = parseInt(parsed[2], 10);
    content = parsed[1] + parsed[3];
  }

  return [spanCount, content];
}

function extendTableCellIndexWithRowspanMap(
  node: MergedTableCell,
  parent: MergedTableRow,
  rowspan: number
) {
  const prevRow = parent.prev;
  const columnLen = parent.parent.parent.columns.length;

  if (prevRow) {
    // increment the index when prev row has the rowspan count.
    for (let i = node.startIdx; i < columnLen; i += 1) {
      const prevRowspanCount = prevRow.rowspanMap[i];

      if (prevRowspanCount && prevRowspanCount > 1) {
        parent.rowspanMap[i] = prevRowspanCount - 1;

        if (i <= node.endIdx) {
          node.startIdx += 1;
          node.endIdx += 1;
        }
      }
    }
  }

  if (rowspan > 1) {
    for (let i = node.startIdx; i <= node.endIdx; i += 1) {
      parent.rowspanMap[i] = rowspan;
    }
  }
}

export const markdownParsers: CustomParserMap = {
  // @ts-expect-error
  tableRow(node: MergedTableRow, { entering }) {
    if (entering) {
      node.rowspanMap = {};

      if (node.prev && !node.firstChild) {
        const prevRowspanMap = node.prev.rowspanMap;

        Object.keys(prevRowspanMap).forEach((key) => {
          if (prevRowspanMap[key] > 1) {
            node.rowspanMap[key] = prevRowspanMap[key] - 1;
          }
        });
      }
    }
  },
  // @ts-expect-error
  tableCell(node: MergedTableCell, { entering }) {
    const { parent, prev, stringContent } = node;

    if (entering) {
      let content = stringContent!;
      let [colspan, rowspan] = [1, 1];

      [colspan, content] = getSpanInfo(content, '@cols', '@rows');
      [rowspan, content] = getSpanInfo(content, '@rows', '@cols');

      if (prev) {
        node.startIdx = prev.endIdx + 1;
        node.endIdx = node.startIdx;
      }
      if (colspan > 1) {
        node.colspan = colspan;
        node.endIdx += colspan - 1;
      }
      if (rowspan > 1) {
        node.rowspan = rowspan;
      }

      extendTableCellIndexWithRowspanMap(node, parent, rowspan);

      const tablePart = parent!.parent!;

      if (tablePart.type === 'tableBody' && node.endIdx >= tablePart.parent.columns.length) {
        node.ignored = true;
      }
    }
  },
};
