export const saved = [];
export class jsPDF {
  setFontSize() {} setTextColor() {} text() {} setFillColor() {} rect() {} setFont() {}
  save(name) { saved.push(name); }
}