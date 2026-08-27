import 'exceljs';

declare module 'exceljs' {
  interface DataValidationRule {
    type?: string;
    allowBlank?: boolean;
    showInputMessage?: boolean;
    showErrorMessage?: boolean;
    formulae?: string[];
    promptTitle?: string;
    prompt?: string;
  }

  interface DataValidations {
    add(range: string, rule: DataValidationRule): void;
  }

  interface Worksheet {
    dataValidations: DataValidations;
  }
}

export {};
