export interface ValidationError {
  code: string;
  field?: string;
  message: string;
}

export interface ValidationWarning {
  code: string;
  field?: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  validatedAt: string;
}
