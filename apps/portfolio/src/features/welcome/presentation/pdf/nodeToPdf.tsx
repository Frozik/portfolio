import { Link, Text, View } from '@react-pdf/renderer';
import type { ReactElement, ReactNode } from 'react';
import { Children, Fragment, isValidElement } from 'react';

import { pdfStyles } from './pdfStyles';

interface IInlineStyle {
  readonly bold?: boolean;
}

const EMPTY_INLINE_STYLE: IInlineStyle = {};

function getElementType(element: ReactElement): string | null {
  return typeof element.type === 'string' ? element.type : null;
}

function isFragmentElement(element: ReactElement): boolean {
  return element.type === Fragment;
}

function flattenBlockNodes(node: ReactNode): ReactNode[] {
  const flat: ReactNode[] = [];
  Children.forEach(Children.toArray(node), child => {
    if (isValidElement(child) && isFragmentElement(child)) {
      const fragmentProps = child.props as { children?: ReactNode };
      flat.push(...flattenBlockNodes(fragmentProps.children));
      return;
    }
    flat.push(child);
  });
  return flat;
}

function isWhitespaceString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length === 0;
}

export function renderRichBlocks(node: ReactNode): ReactNode[] {
  const blocks: ReactNode[] = [];
  flattenBlockNodes(node).forEach((child, index) => {
    const rendered = renderBlock(child, index);
    if (rendered !== null) {
      blocks.push(rendered);
    }
  });
  return blocks;
}

export function renderInlineNode(node: ReactNode): ReactNode {
  return renderInlineChildren(node, EMPTY_INLINE_STYLE);
}

function renderBlock(node: ReactNode, key: number): ReactNode {
  if (isWhitespaceString(node) || node === null || node === undefined || node === false) {
    return null;
  }
  if (!isValidElement(node)) {
    return null;
  }
  const type = getElementType(node);
  const props = node.props as { children?: ReactNode };
  if (type === 'h4' || type === 'h3' || type === 'h5') {
    return (
      <Text key={key} style={pdfStyles.descHeading}>
        {renderInlineChildren(props.children, EMPTY_INLINE_STYLE)}
      </Text>
    );
  }
  if (type === 'p') {
    return (
      <Text key={key} style={pdfStyles.descParagraph}>
        {renderInlineChildren(props.children, EMPTY_INLINE_STYLE)}
      </Text>
    );
  }
  if (type === 'ul' || type === 'ol') {
    const items: ReactNode[] = [];
    Children.forEach(Children.toArray(props.children), (li, liIndex) => {
      const renderedItem = renderListItem(li, liIndex);
      if (renderedItem !== null) {
        items.push(renderedItem);
      }
    });
    return (
      <View key={key} style={pdfStyles.descList}>
        {items}
      </View>
    );
  }
  return null;
}

function isNestedListElement(node: ReactNode): boolean {
  if (!isValidElement(node)) {
    return false;
  }
  const type = getElementType(node);
  return type === 'ul' || type === 'ol';
}

function renderListItem(node: ReactNode, key: number): ReactNode {
  if (!isValidElement(node) || getElementType(node) !== 'li') {
    return null;
  }
  const props = node.props as { children?: ReactNode };

  // An <li>'s inline content renders next to the bullet; nested <ul>/<ol> render
  // as indented block lists below — otherwise they collapse to bulletless inline text.
  const inlineChildren: ReactNode[] = [];
  const nestedLists: ReactNode[] = [];
  Children.forEach(Children.toArray(props.children), child => {
    if (isNestedListElement(child)) {
      nestedLists.push(child);
    } else {
      inlineChildren.push(child);
    }
  });

  const nestedBlocks: ReactNode[] = [];
  nestedLists.forEach((nestedList, nestedIndex) => {
    const renderedList = renderBlock(nestedList, nestedIndex);
    if (renderedList !== null) {
      nestedBlocks.push(renderedList);
    }
  });

  return (
    <View key={key} style={pdfStyles.descListItem} wrap={false}>
      <Text style={pdfStyles.descBullet}>•</Text>
      <View style={pdfStyles.descListText}>
        <Text>{renderInlineChildren(inlineChildren, EMPTY_INLINE_STYLE)}</Text>
        {nestedBlocks.length > 0 && <View style={pdfStyles.descNestedList}>{nestedBlocks}</View>}
      </View>
    </View>
  );
}

function renderInlineChildren(children: ReactNode, style: IInlineStyle): ReactNode {
  const items: ReactNode[] = [];
  Children.forEach(Children.toArray(children), (child, index) => {
    const rendered = renderInline(child, index, style);
    if (rendered !== null && rendered !== undefined) {
      items.push(rendered);
    }
  });
  return items;
}

function renderInline(child: ReactNode, key: number, style: IInlineStyle): ReactNode {
  if (typeof child === 'string' || typeof child === 'number') {
    if (style.bold) {
      return (
        <Text key={key} style={pdfStyles.bold}>
          {child}
        </Text>
      );
    }
    return child;
  }
  if (!isValidElement(child)) {
    return null;
  }
  const type = getElementType(child);
  const props = child.props as { children?: ReactNode; href?: string };
  if (type === 'strong' || type === 'b') {
    return (
      <Text key={key} style={pdfStyles.bold}>
        {renderInlineChildren(props.children, { ...style, bold: true })}
      </Text>
    );
  }
  if (type === 'em' || type === 'i') {
    return renderInlineChildren(props.children, style);
  }
  if (type === 'a') {
    return (
      <Link key={key} src={props.href ?? ''} style={pdfStyles.link}>
        {renderInlineChildren(props.children, style)}
      </Link>
    );
  }
  return renderInlineChildren(props.children, style);
}
