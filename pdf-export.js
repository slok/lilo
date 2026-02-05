(() => {
  if (!window.PDFLib) {
    return;
  }

  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;

  const A4_WIDTH = 595.28;
  const A4_HEIGHT = 841.89;
  const DEFAULT_SYMBOL_FONT_URL =
    "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts/hinted/ttf/NotoSansSymbols2/NotoSansSymbols2-Regular.ttf";
  const TILE_COLS = 70;
  const TILE_ROWS = 100;
  const PAGE_MARGIN = 36;
  const FOOTER_HEIGHT = 24;
  const TOP_INDEX_HEIGHT = 18;
  const LEFT_INDEX_WIDTH = 22;
  const GRID_LINE_THIN = 0.3;
  const GRID_LINE_THICK = 0.9;

  const dmcToAnchorMap = window.dmcToAnchorMap || {};
  const buildReverseMap = (map) => {
    const reverse = {};
    Object.entries(map).forEach(([fromCode, toCodes]) => {
      if (!Array.isArray(toCodes)) return;
      toCodes.forEach((toCode) => {
        if (!toCode) return;
        if (!reverse[toCode]) {
          reverse[toCode] = [];
        }
        if (!reverse[toCode].includes(fromCode)) {
          reverse[toCode].push(fromCode);
        }
      });
    });
    return reverse;
  };
  const anchorToDmcMap = buildReverseMap(dmcToAnchorMap);

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const hexToRgb = (hex) => {
    const normalized = hex.replace("#", "");
    const bigint = parseInt(normalized, 16);
    return {
      r: ((bigint >> 16) & 255) / 255,
      g: ((bigint >> 8) & 255) / 255,
      b: (bigint & 255) / 255,
    };
  };

  const getLuminance = (hex) => {
    const color = hexToRgb(hex);
    return 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
  };

  const formatNumber = (value) => {
    if (!Number.isFinite(value)) return "0";
    return value.toFixed(2).replace(/\.00$/, "");
  };

  const buildLegendItems = (counts, palette, symbols, hiddenSet, paletteId) => {
    const items = [];
    const indexMap = new Map();
    counts.forEach((count, index) => {
      if (!count || !palette[index]) return;
      const color = palette[index];
      if (hiddenSet?.has(color.hex.toLowerCase())) return;
      const key = color.hex.toLowerCase();
      const existing = indexMap.get(key);
      if (existing) {
        existing.count += count;
        return;
      }
      const symbol = symbols[index] || "";
      let dmcCode = "";
      let anchorCode = "";
      if (paletteId === "dmc") {
        dmcCode = color.code || "";
        anchorCode = (dmcToAnchorMap[color.code] || [])[0] || "";
      } else if (paletteId === "anchor") {
        anchorCode = color.code || "";
        dmcCode = (anchorToDmcMap[color.code] || [])[0] || "";
      }
      const item = {
        symbol,
        color,
        count,
        dmcCode,
        anchorCode,
      };
      indexMap.set(key, item);
      items.push(item);
    });
    return items;
  };

  const drawCenteredText = (page, text, x, y, font, size, color, offsetX = 0, offsetY = 0) => {
    const textWidth = font.widthOfTextAtSize(text, size);
    const textHeight = font.heightAtSize(size);
    const descent = typeof font.descentAtSize === "function" ? font.descentAtSize(size) : 0;
    const baselineY = y - (textHeight / 2 + descent) + offsetY;
    page.drawText(text, {
      x: x - textWidth / 2 + offsetX,
      y: baselineY,
      size,
      font,
      color,
    });
  };

  const drawArrow = (page, x, y, direction, size) => {
    const half = size / 2;
    let path = "";
    if (direction === "down") {
      path = `M0 0 L${size} 0 L${half} ${size} Z`;
    } else if (direction === "up") {
      path = `M0 ${size} L${size} ${size} L${half} 0 Z`;
    } else if (direction === "right") {
      path = `M0 0 L0 ${size} L${size} ${half} Z`;
    } else if (direction === "left") {
      path = `M${size} 0 L${size} ${size} L0 ${half} Z`;
    }
    if (!path) return;
    page.drawSvgPath(path, {
      x: x - half,
      y: y - half,
      color: rgb(0, 0, 0),
    });
  };

  const drawGridPage = ({
    page,
    tileStartX,
    tileStartY,
    gridWidth,
    gridHeight,
    mappedPixels,
    palette,
    symbols,
    patternMode,
    hiddenSet,
    font,
    symbolFont,
    pageNumber,
    tileCols = TILE_COLS,
    tileRows = TILE_ROWS,
  }) => {
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();

    const availableWidth = pageWidth - PAGE_MARGIN * 2 - LEFT_INDEX_WIDTH;
    const availableHeight = pageHeight - PAGE_MARGIN * 2 - FOOTER_HEIGHT - TOP_INDEX_HEIGHT;

    const cellSize = Math.min(availableWidth / tileCols, availableHeight / tileRows);
    const gridPixelWidth = cellSize * tileCols;
    const gridPixelHeight = cellSize * tileRows;

    const gridLeft = PAGE_MARGIN + LEFT_INDEX_WIDTH;
    const gridBottom = PAGE_MARGIN + FOOTER_HEIGHT;
    const gridTop = gridBottom + gridPixelHeight;

    page.drawRectangle({
      x: gridLeft,
      y: gridBottom,
      width: gridPixelWidth,
      height: gridPixelHeight,
      color: rgb(1, 1, 1),
    });

    const symbolSize = clamp(cellSize * 0.55, 4, 9);
    const arrowSize = clamp(cellSize * 0.7, 5, 10);
    const useSymbolFont = Boolean(symbolFont);
    const symbolOffsetY = useSymbolFont ? symbolSize * 0.2 : 0;

    for (let row = 0; row < tileRows; row += 1) {
      const globalRow = tileStartY + row;
      if (globalRow >= gridHeight) break;
      for (let col = 0; col < tileCols; col += 1) {
        const globalCol = tileStartX + col;
        if (globalCol >= gridWidth) break;
        const index = globalRow * gridWidth + globalCol;
        const paletteIndex = mappedPixels[index];
        const color = palette[paletteIndex];
        if (!color) continue;

        const cellX = gridLeft + col * cellSize;
        const cellY = gridTop - (row + 1) * cellSize;

        if (hiddenSet?.has(color.hex.toLowerCase())) {
          continue;
        }

        if (patternMode !== "symbols") {
          const fill = hexToRgb(color.hex);
          page.drawRectangle({
            x: cellX,
            y: cellY,
            width: cellSize,
            height: cellSize,
            color: rgb(fill.r, fill.g, fill.b),
          });
        }

        if (patternMode !== "color") {
          const symbol = symbols[paletteIndex] || "";
          if (symbol) {
            const safeSymbol = useSymbolFont ? symbol : symbol.replace(/[^\x00-\x7F]/g, "?");
            const textColor =
              patternMode === "symbols"
                ? rgb(0, 0, 0)
                : getLuminance(color.hex) > 0.6
                  ? rgb(0.1, 0.1, 0.1)
                  : rgb(0.96, 0.96, 0.96);
            drawCenteredText(
              page,
              safeSymbol,
              cellX + cellSize / 2,
              cellY + cellSize / 2,
              useSymbolFont ? symbolFont : font,
              symbolSize,
              textColor,
              0,
              symbolOffsetY
            );
          }
        }
      }
    }

    for (let col = 0; col <= tileCols; col += 1) {
      const x = gridLeft + col * cellSize;
      const isMajor = col % 10 === 0;
      page.drawLine({
        start: { x, y: gridBottom },
        end: { x, y: gridTop },
        thickness: isMajor ? GRID_LINE_THICK : GRID_LINE_THIN,
        color: rgb(0, 0, 0),
      });
    }

    for (let row = 0; row <= tileRows; row += 1) {
      const y = gridTop - row * cellSize;
      const isMajor = row % 10 === 0;
      page.drawLine({
        start: { x: gridLeft, y },
        end: { x: gridLeft + gridPixelWidth, y },
        thickness: isMajor ? GRID_LINE_THICK : GRID_LINE_THIN,
        color: rgb(0, 0, 0),
      });
    }

    const indexFontSize = clamp(cellSize * 0.55, 6, 9);
    const indexColor = rgb(0, 0, 0);

    const startColNumber = Math.ceil(tileStartX / 10) * 10;
    for (let value = startColNumber; value <= tileStartX + tileCols; value += 10) {
      if (value === 0) continue;
      if (value > gridWidth) continue;
      const offset = value - tileStartX;
      const x = gridLeft + offset * cellSize;
      const text = String(value);
      const textWidth = font.widthOfTextAtSize(text, indexFontSize);
      page.drawText(text, {
        x: x - textWidth / 2,
        y: gridTop + 4,
        size: indexFontSize,
        font,
        color: indexColor,
      });
    }

    const startRowNumber = Math.ceil(tileStartY / 10) * 10;
    for (let value = startRowNumber; value <= tileStartY + tileRows; value += 10) {
      if (value === 0) continue;
      if (value > gridHeight) continue;
      const offset = value - tileStartY;
      const y = gridTop - offset * cellSize;
      const text = String(value);
      const textWidth = font.widthOfTextAtSize(text, indexFontSize);
      page.drawText(text, {
        x: gridLeft - 6 - textWidth,
        y: y - indexFontSize / 2,
        size: indexFontSize,
        font,
        color: indexColor,
      });
    }

    const footer = `Page: ${pageNumber}`;
    const footerSize = 9;
    const footerWidth = font.widthOfTextAtSize(footer, footerSize);
    page.drawText(footer, {
      x: pageWidth - PAGE_MARGIN - footerWidth,
      y: PAGE_MARGIN - 4,
      size: footerSize,
      font,
      color: rgb(0, 0, 0),
    });

    const signature = "https://lilo.slok.dev/";
    page.drawText(signature, {
      x: PAGE_MARGIN,
      y: PAGE_MARGIN - 4,
      size: footerSize,
      font,
      color: rgb(0, 0, 0),
    });

    const maxCols = Math.min(tileCols, gridWidth - tileStartX);
    const maxRows = Math.min(tileRows, gridHeight - tileStartY);
    const centerCol = Math.floor(gridWidth / 2);
    const centerRow = Math.floor(gridHeight / 2);

    if (centerCol >= tileStartX && centerCol < tileStartX + maxCols) {
      const localCol = centerCol - tileStartX;
      const x = gridLeft + localCol * cellSize;
      drawArrow(page, x, gridTop + TOP_INDEX_HEIGHT + arrowSize - 16, "down", arrowSize);
    }

    if (centerRow >= tileStartY && centerRow < tileStartY + maxRows) {
      const localRow = centerRow - tileStartY;
      const y = gridTop - (localRow - 1) * cellSize;
      drawArrow(page, gridLeft - 2, y, "right", arrowSize);
    }
  };

  const drawLegendPages = ({
    pdfDoc,
    items,
    gridWidth,
    gridHeight,
    fabricCount,
    fabricUnit,
    patternMode,
    font,
    fontBold,
    symbolFont,
    pageStart,
    pageSize = [A4_WIDTH, A4_HEIGHT],
  }) => {
    const [pageWidth, pageHeight] = pageSize;
    const margin = PAGE_MARGIN;
    const headerTop = pageHeight - margin;
    const legendTitle = "Legend";
    const headerFontSize = 20;
    const metaFontSize = 11;
    const headerGap = 10;
    const metaLineHeight = 14;
    const bodyGap = 16;

    const designWidthIn = gridWidth / fabricCount;
    const designHeightIn = gridHeight / fabricCount;
    const designWidthCm = designWidthIn * 2.54;
    const designHeightCm = designHeightIn * 2.54;

    const metaLines = [
      `Grid Size: ${gridWidth} x ${gridHeight} stitches`,
      `Design Area: ${formatNumber(designWidthIn)}in x ${formatNumber(designHeightIn)}in`,
      `Design Area: ${formatNumber(designWidthCm)}cm x ${formatNumber(designHeightCm)}cm`,
    ];

    const showSymbols = patternMode !== "color";
    const useSymbolFont = Boolean(symbolFont);
    const legendSymbolOffsetY = useSymbolFont ? 1.5 : 0;

    const rowHeight = 20;
    const headerRowHeight = rowHeight;
    const symbolSize = 13;
    const swatchSize = 13;
    const columnGap = 24;
    const codeColumnWidth = 60;
    const anchorColumnWidth = 70;
    const nameColumnWidth = 170;
    const stitchesColumnWidth = 90;
    const columnPadding = 10;
    const swatchBlockWidth = swatchSize + 8;
    const symbolBlockWidth = showSymbols ? symbolSize + 6 : 0;
    const textBlockWidth =
      codeColumnWidth +
      anchorColumnWidth +
      nameColumnWidth +
      stitchesColumnWidth +
      columnPadding * 3;
    const baseColumnWidth = symbolBlockWidth + swatchBlockWidth + textBlockWidth;

    const titleY = headerTop - headerFontSize;
    const headerLineY = titleY - headerGap;
    const metaStartY = headerLineY - metaLineHeight;
    const bodyTop = metaStartY - metaLineHeight * metaLines.length - bodyGap;
    const availableHeight = bodyTop - margin;
    const rowsPerColumn = Math.max(
      1,
      Math.floor((availableHeight - headerRowHeight) / rowHeight)
    );
    const columnsNeeded = Math.ceil(items.length / rowsPerColumn) || 1;
    const columnsPerPage = Math.max(
      1,
      Math.floor((pageWidth - margin * 2 + columnGap) / (baseColumnWidth + columnGap))
    );

    let currentIndex = 0;
    let pageNumber = pageStart;

    while (currentIndex < items.length) {
      const page = pdfDoc.addPage([pageWidth, pageHeight]);

      page.drawText(legendTitle, {
        x: margin,
        y: titleY,
        size: headerFontSize,
        font: fontBold,
        color: rgb(0, 0, 0),
      });

      page.drawLine({
        start: { x: margin, y: headerLineY },
        end: { x: pageWidth - margin, y: headerLineY },
        thickness: 0.6,
        color: rgb(0, 0, 0),
      });

      let metaY = metaStartY;
      metaLines.forEach((line) => {
        page.drawText(line, {
          x: margin,
          y: metaY,
          size: metaFontSize,
          font,
          color: rgb(0, 0, 0),
        });
        metaY -= metaLineHeight;
      });

      let startY = bodyTop;
      let column = 0;
      while (column < columnsPerPage && currentIndex < items.length) {
        const columnX = margin + column * (baseColumnWidth + columnGap);
        let headerX = columnX;
        if (showSymbols) {
          headerX += symbolBlockWidth;
        }
        headerX += swatchBlockWidth;

        const dmcX = headerX;
        const anchorX = dmcX + codeColumnWidth + columnPadding;
        const nameX = anchorX + anchorColumnWidth + columnPadding;
        const stitchesX = nameX + nameColumnWidth + columnPadding;

        page.drawText("DMC code", {
          x: dmcX,
          y: startY - 6,
          size: 9,
          font: fontBold,
          color: rgb(0, 0, 0),
        });
        page.drawText("Anchor code", {
          x: anchorX,
          y: startY - 6,
          size: 9,
          font: fontBold,
          color: rgb(0, 0, 0),
        });
        page.drawText("Color name", {
          x: nameX,
          y: startY - 6,
          size: 9,
          font: fontBold,
          color: rgb(0, 0, 0),
        });
        page.drawText("Stitches", {
          x: stitchesX,
          y: startY - 6,
          size: 9,
          font: fontBold,
          color: rgb(0, 0, 0),
        });

        for (let row = 0; row < rowsPerColumn && currentIndex < items.length; row += 1) {
          const item = items[currentIndex];
          const y = startY - headerRowHeight - row * rowHeight;

          let x = columnX;
          if (showSymbols) {
            const safeSymbol = useSymbolFont ? item.symbol : item.symbol.replace(/[^\x00-\x7F]/g, "?");
            const boxOffset = 4;
            page.drawRectangle({
              x,
              y: y - symbolSize + boxOffset,
              width: symbolSize,
              height: symbolSize,
              borderColor: rgb(0, 0, 0),
              borderWidth: 0.6,
              color: rgb(1, 1, 1),
            });
            drawCenteredText(
              page,
              safeSymbol,
              x + symbolSize / 2,
              y - symbolSize / 2 + boxOffset,
              useSymbolFont ? symbolFont : font,
              10,
              rgb(0, 0, 0),
              0,
              legendSymbolOffsetY
            );
            x += symbolSize + 6;
          }

          const fill = hexToRgb(item.color.hex);
          page.drawRectangle({
            x,
            y: y - swatchSize + 4,
            width: swatchSize,
            height: swatchSize,
            borderColor: rgb(0, 0, 0),
            borderWidth: 0.6,
            color: rgb(fill.r, fill.g, fill.b),
          });
          x += swatchSize + 8;

          const dmcCode = item.dmcCode || "-";
          const anchorCode = item.anchorCode || "-";
          const name = item.color.name || "";
          const stitches = `${item.count} stitches`;
          page.drawText(dmcCode, {
            x: dmcX,
            y: y - 6,
            size: 10,
            font,
            color: rgb(0, 0, 0),
          });
          page.drawText(anchorCode, {
            x: anchorX,
            y: y - 6,
            size: 10,
            font,
            color: rgb(0, 0, 0),
          });
          page.drawText(name, {
            x: nameX,
            y: y - 6,
            size: 10,
            font,
            color: rgb(0, 0, 0),
          });
          page.drawText(stitches, {
            x: stitchesX,
            y: y - 6,
            size: 10,
            font,
            color: rgb(0, 0, 0),
          });

          currentIndex += 1;
        }
        column += 1;
      }

      const footer = `Page: ${pageNumber}`;
      const footerSize = 9;
      const footerWidth = font.widthOfTextAtSize(footer, footerSize);
      page.drawText(footer, {
        x: pageWidth - margin - footerWidth,
        y: margin - 4,
        size: footerSize,
        font,
        color: rgb(0, 0, 0),
      });

      page.drawText("https://lilo.slok.dev/", {
        x: margin,
        y: margin - 4,
        size: footerSize,
        font,
        color: rgb(0, 0, 0),
      });

      pageNumber += 1;
    }

    return pageNumber;
  };

  const downloadPatternPdf = async ({
    gridWidth,
    gridHeight,
    mappedPixels,
    mappedPalette,
    counts,
    symbols,
    symbolFontUrl,
    fabricCount,
    fabricUnit,
    patternMode,
    hiddenColors = [],
    splitMode = true,
    paletteId,
  }) => {
    if (!mappedPixels || !gridWidth || !gridHeight) return;

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    let symbolFont = null;

    if (window.fontkit) {
      try {
        pdfDoc.registerFontkit(window.fontkit);
        const fontUrl = symbolFontUrl || DEFAULT_SYMBOL_FONT_URL;
        const fontBytes = await fetch(fontUrl).then((res) => res.arrayBuffer());
        symbolFont = await pdfDoc.embedFont(fontBytes);
      } catch (error) {
        symbolFont = null;
      }
    }

    const tilesX = Math.ceil(gridWidth / TILE_COLS);
    const tilesY = Math.ceil(gridHeight / TILE_ROWS);

    const hiddenSet = new Set(hiddenColors.map((hex) => hex.toLowerCase()));

    let pageNumber = 1;
    const singlePageLandscape = !splitMode && gridWidth > gridHeight;
    const singlePageSize = singlePageLandscape ? [A4_HEIGHT, A4_WIDTH] : [A4_WIDTH, A4_HEIGHT];
    if (splitMode) {
      for (let tileY = 0; tileY < tilesY; tileY += 1) {
        for (let tileX = 0; tileX < tilesX; tileX += 1) {
          const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
          drawGridPage({
            page,
            tileStartX: tileX * TILE_COLS,
            tileStartY: tileY * TILE_ROWS,
            gridWidth,
            gridHeight,
            mappedPixels,
            palette: mappedPalette,
            symbols,
            patternMode,
            hiddenSet,
            font,
            symbolFont,
            pageNumber,
          });
          pageNumber += 1;
        }
      }
    } else {
      const page = pdfDoc.addPage(singlePageSize);
      drawGridPage({
        page,
        tileStartX: 0,
        tileStartY: 0,
        gridWidth,
        gridHeight,
        mappedPixels,
        palette: mappedPalette,
        symbols,
        patternMode,
        hiddenSet,
        font,
        symbolFont,
        pageNumber,
        tileCols: gridWidth,
        tileRows: gridHeight,
      });
      pageNumber += 1;
    }

    const legendItems = buildLegendItems(
      counts,
      mappedPalette,
      symbols,
      hiddenSet,
      paletteId
    );
    const nextPage = drawLegendPages({
      pdfDoc,
      items: legendItems,
      gridWidth,
      gridHeight,
      fabricCount,
      fabricUnit,
      patternMode,
      font,
      fontBold,
      symbolFont,
      pageStart: pageNumber,
      pageSize: splitMode ? [A4_WIDTH, A4_HEIGHT] : singlePageSize,
    });

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "cross-stitch-pattern.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  window.LiloPdf = { downloadPatternPdf };
})();
