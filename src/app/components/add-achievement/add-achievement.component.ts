import {
  Component,
  OnInit,
  ViewChild,
  HostListener,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { MainCriterion } from 'src/app/model/criteria';
import { CriteriaService, SubCriteria } from 'src/app/service/criteria.service';
import Swal from 'sweetalert2';
import { ActivityService } from '../../service/achievements-service.service';
import { ActivatedRoute, Router } from '@angular/router';
import { QuillEditorComponent } from 'ngx-quill';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { environment } from 'src/app/environments/environments';
import { DomSanitizer } from '@angular/platform-browser';
import {
  RICH_TEXT_EDITOR_MODULES,
  RICH_TEXT_EDITOR_STYLES,
  htmlToPlainText,
  registerQuillFormats,
} from 'src/app/shared/quill-editor.config';
import Quill from 'quill';

@Component({
  selector: 'app-add-achievement',
  templateUrl: './add-achievement.component.html',
  styleUrls: ['./add-achievement.component.css'],
})
export class AddAchievementComponent implements OnInit {
  @ViewChild('descriptionEditor', { static: true })
  descriptionEditor!: QuillEditorComponent;

  form!: FormGroup;
  attachments: File[] = [];
  existingAttachments: string[] = [];
  subCriteria: SubCriteria[] = [];
  mainCriteria: MainCriterion[] = [];
  selectedMain = '';
  maxFiles = 2;
  maxFileSizeMB = 8;
  isEditing = false;
  draftId: string = '';
  originalDraftData: any = null;
  deletedAttachments: string[] = [];
  isMobileView = false;

  showTableModal = false;
  tableRows = 3;
  tableCols = 3;
  currentTableData: any[][] = [];
  editingTableIndex: number | null = null;
  tablesArray: any[] = [];
  private lastFocusedCell: { row: number; col: number } | null = null;
  tableAlignment: 'right' | 'center' | 'left' = 'right';
  lastSelectedAlignment: 'right' | 'center' | 'left' = 'right';

  pdfGenerating = false;
  pdfLoading = false;
  pdfFilename: string | null = null;

  quillModules = RICH_TEXT_EDITOR_MODULES;
  quillStyles = RICH_TEXT_EDITOR_STYLES;

  private readonly fontWhitelist = [
    '', 'cairo', 'tajawal', 'amiri', 'noto-naskh', 'reem-kufi',
    'lateef', 'scheherazade', 'rakkas', 'mada', 'ibm-plex-arabic',
    'harmattan', 'markazi', 'aref-ruqaa', 'el-messiri', 'jomhuria',
    'mirza', 'katibeh', 'lalezar', 'serif', 'monospace', 'arial', 'times-new-roman',
  ];

  private readonly sizeWhitelist = [
    '10px', '11px', '12px', '13px', '14px', '15px', '16px',
    '18px', '20px', '22px', '24px', '26px', '28px', '32px',
    '36px', '40px', '48px', '56px', '72px',
  ];

  // ==================== أسماء العرض للخطوط في الـ dropdown ====================
  private readonly fontDisplayNames: { [key: string]: string } = {
    'cairo': 'Cairo',
    'tajawal': 'Tajawal',
    'amiri': 'Amiri',
    'noto-naskh': 'Noto Naskh',
    'reem-kufi': 'Reem Kufi',
    'lateef': 'Lateef',
    'scheherazade': 'Scheherazade',
    'rakkas': 'Rakkas',
    'mada': 'Mada',
    'ibm-plex-arabic': 'IBM Plex',
    'harmattan': 'Harmattan',
    'markazi': 'Markazi',
    'aref-ruqaa': 'Aref Ruqaa',
    'el-messiri': 'El Messiri',
    'jomhuria': 'Jomhuria',
    'mirza': 'Mirza',
    'katibeh': 'Katibeh',
    'lalezar': 'Lalezar',
    'serif': 'Serif',
    'monospace': 'Monospace',
    'arial': 'Arial',
    'times-new-roman': 'Times New Roman',
  };

  constructor(
    private fb: FormBuilder,
    private criteriaService: CriteriaService,
    private activityService: ActivityService,
    private route: ActivatedRoute,
    private router: Router,
    private sanitizer: DomSanitizer
  ) {
    this.setupQuillFormats();
    this.quillModules = {
      toolbar: {
        container: [
          ['bold', 'italic', 'underline', 'strike'],
          [{ 'direction': 'rtl' }],
          [{ 'align': ['right', 'center', 'justify'] }],
          [{ 'font': this.fontWhitelist }],
          [{ 'size': this.sizeWhitelist }],
          [{ 'list': 'ordered' }, { 'list': 'bullet' }],
          ['clean'],
        ],
      },
    };
    this.quillStyles = RICH_TEXT_EDITOR_STYLES;
  }

  // ==================== إعدادات الـ Quill المخصصة ====================

  /**
   * تسجيل الـ formats المخصصة للخطوط والأحجام
   * - الخطوط: نستخدم class-based attributor ليعمل مع الـ CSS الموجود
   * - الأحجام: نستخدم style-based attributor لدعم قيم البكسل المخصصة
   */
  private setupQuillFormats(): void {
    try { registerQuillFormats(); } catch (e) { /* ignore */ }

    // تسجيل الخطوط (class-based) مع الـ whitelist الخاص بنا
    const FontAttributor: any = Quill.import('attributors/class/font');
    if (FontAttributor) {
      FontAttributor.whitelist = this.fontWhitelist.filter((f) => f !== '');
      Quill.register(FontAttributor, true);
    }

    // تسجيل الأحجام (style-based) لدعم قيم مثل 14px, 16px
    // هذا هو الحل الأساسي لمشكلة ظهور "normal" متكررة
    const SizeAttributor: any = Quill.import('attributors/style/size');
    if (SizeAttributor) {
      SizeAttributor.whitelist = this.sizeWhitelist;
      Quill.register(SizeAttributor, true);
    }
  }
  /**
   * تعديل الـ labels في الـ dropdown الخاص بالخطوط والأحجام
   * بعد إنشاء الـ editor مباشرة
   */
  private fixToolbarLabels(): void {
    const sizeLabels: { [key: string]: string } = {};
    this.sizeWhitelist.forEach((s) => (sizeLabels[s] = s));

    this.fixPickerLabels('font', this.fontDisplayNames, 'الخط');
    this.fixPickerLabels('size', sizeLabels, 'الحجم');
  }

  /**
   * تعديل labels لأي picker في الـ toolbar
   */
  private fixPickerLabels(
    pickerType: string,
    labels: { [key: string]: string },
    defaultLabel: string
  ): void {
    const picker = document.querySelector(
      `.ql-toolbar .ql-${pickerType}`
    ) as HTMLElement;
    if (!picker) return;

    picker.querySelectorAll('.ql-picker-item').forEach((item) => {
      const value = item.getAttribute('data-value') || '';
      const label = labels[value] || value;
      item.setAttribute('data-label', label);
    });

    const labelSpan = picker.querySelector(
      '.ql-picker-label span'
    ) as HTMLElement;
    if (labelSpan) {
      labelSpan.textContent = defaultLabel;
    }

    const observer = new MutationObserver(() => {
      const selected = picker.querySelector(
        '.ql-picker-item.ql-selected'
      ) as HTMLElement;
      const span = picker.querySelector(
        '.ql-picker-label span'
      ) as HTMLElement;
      if (span) {
        span.textContent = selected
          ? selected.getAttribute('data-label') ||
            selected.getAttribute('data-value') ||
            defaultLabel
          : defaultLabel;
      }
    });

    observer.observe(picker, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  // ==================== نهاية إعدادات الـ Quill المخصصة ====================

  ngOnInit(): void {
    this.checkViewport();
    this.initializeForm();
    this.loadMainCriteria();
    this.checkEditMode();
    this.setupQuillListener();
    this.injectQuillFontStyles();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.checkViewport();
  }

  private checkViewport(): void {
    this.isMobileView = window.innerWidth < 992;
  }

  checkEditMode(): void {
    this.route.queryParams.subscribe((params) => {
      this.isEditing = params['edit'] === 'true';
      this.draftId = params['draftId'] || '';
      if (this.isEditing) {
        this.loadDraftData();
      }
    });
  }

  loadDraftData(): void {
    const savedDraft = localStorage.getItem('editingDraft');
    if (savedDraft) {
      try {
        this.originalDraftData = JSON.parse(savedDraft);
        this.populateFormWithDraftData();
      } catch (error) {
        this.showError('حدث خطأ في تحميل بيانات المسودة');
      }
    }
  }

populateFormWithDraftData(): void {
  if (this.originalDraftData && this.form) {
    this.form.patchValue({
      activityTitle: this.originalDraftData.activityTitle,
      MainCriteria: this.originalDraftData.MainCriteria?._id || this.originalDraftData.MainCriteria,
      SubCriteria: this.originalDraftData.SubCriteria?._id || this.originalDraftData.SubCriteria,
      name: this.originalDraftData.name,
    });

    // ✅ جرّب الاتنين: Attachments (capital) أو files (lowercase)
    const attachments =
      this.originalDraftData.Attachments ||
      this.originalDraftData.files ||
      [];

    if (Array.isArray(attachments) && attachments.length > 0) {
      this.existingAttachments = [...attachments];
    } else {
      this.existingAttachments = [];
    }

    this.tablesArray = [];
    let textContent = '';
    const descData = this.originalDraftData.activityDescription;

    if (Array.isArray(descData)) {
      descData.forEach((item: string) => {
        if (item && (item.includes('<table') || item.includes('table-responsive'))) {
          this.tablesArray.push({
            html: item,
            rows: 0,
            cols: 0,
            data: [],
            alignment: 'right',
            isTable: true
          });
        } else if (item && item.trim().length > 0) {
          textContent += item;
        }
      });
    } else if (typeof descData === 'string') {
      textContent = descData;
    }

    this.form.patchValue({
      activityDescription: this.extractPlainText(textContent),
    });

    this.updateTablesFormArray();

    if (this.descriptionEditor) {
      setTimeout(() => {
        if (this.descriptionEditor.quillEditor) {
          this.descriptionEditor.quillEditor.root.innerHTML = textContent || '';
        }
      }, 100);
    }

    const mainCriteriaId = this.originalDraftData.MainCriteria?._id || this.originalDraftData.MainCriteria;
    if (mainCriteriaId) {
      this.selectedMain = mainCriteriaId;
      this.getSubCriteria(mainCriteriaId);
    }
  }
}

  initializeForm(): void {
    this.form = this.fb.group(
      {
        activityTitle: ['', [Validators.required, Validators.maxLength(150)]],
        activityDescription: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(1000)]],
        MainCriteria: ['', Validators.required],
        SubCriteria: ['', Validators.required],
        name: [''],
        tables: this.fb.array([]),
      },
      { updateOn: 'change' }
    );
  }

  private setupQuillListener(): void {
    this.form.get('activityDescription')?.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((value) => this.validateDescriptionLength(value));
  }

  get tablesFormArray(): FormArray {
    return this.form.get('tables') as FormArray;
  }

  loadMainCriteria(): void {
    this.criteriaService.getAllMainCriteria().subscribe({
      next: (res: any[]) => { this.mainCriteria = res; },
      error: () => { this.mainCriteria = []; },
    });
  }

  onMainCriterionChange(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    this.selectedMain = target?.value ?? '';
    this.form.patchValue({ SubCriteria: '' });
    if (this.selectedMain) {
      this.getSubCriteria(this.selectedMain);
    } else {
      this.subCriteria = [];
    }
  }

  getSubCriteria(mainId: string): void {
    this.criteriaService.getAllSubCriteria().subscribe({
      next: (res: SubCriteria[]) => {
        this.subCriteria = res.filter((sub) => {
          const mcId = typeof sub.mainCriteria === 'string' ? sub.mainCriteria : sub.mainCriteria._id;
          return mcId === mainId;
        });
      },
      error: () => { this.subCriteria = []; },
    });
  }

  onContentChanged(event: any): void {
    const plainText = this.extractPlainText(event.html || '');
    this.form.patchValue({ activityDescription: plainText }, { emitEvent: false });
    this.validateDescriptionLength(plainText);
  }

  onEditorCreated(editor: any): void {
    editor.format('direction', 'rtl');
    editor.format('align', 'right');
    // ننتظر شوية حتى الـ DOM بتاع الـ toolbar يكتمل
    setTimeout(() => this.fixToolbarLabels(), 500);
  }

  validateDescriptionLength(text: string): void {
    const length = text ? text.length : 0;
    const control = this.form.get('activityDescription');
    if (length < 10) control?.setErrors({ minlength: true });
    else if (length > 1000) control?.setErrors({ maxlength: true });
    else if (control?.errors) control.setErrors(null);
  }

  private extractPlainText(html: string): string {
    if (!html) return '';
    return this.cleanText(htmlToPlainText(html));
  }

  private cleanText(text: string): string {
    if (!text) return '';
    return text.replace(/[\r\n\t\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]+/g, ' ')
      .replace(/\s+/g, ' ').replace(/^\s+/, '').replace(/\s+$/, '').normalize('NFKC')
      .replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0020-\u007E\u00A0-\u00FF\u0100-\u017F\u0180-\u024F\u1E00-\u1EFF]/g, '').trim();
  }

  getDescriptionLength(): number {
    return this.form.get('activityDescription')?.value?.length || 0;
  }

  // ==================== وظائف الجداول ====================

  openTableModal(descriptionIndex?: number): void {
    this.showTableModal = true;
    this.editingTableIndex = descriptionIndex !== undefined ? descriptionIndex : null;
    if (this.editingTableIndex !== null) {
      const existingTable = this.getExistingTable(this.editingTableIndex);
      if (existingTable && existingTable.data && existingTable.data.length > 0) {
        this.tableRows = existingTable.rows;
        this.tableCols = existingTable.cols;
        this.currentTableData = JSON.parse(JSON.stringify(existingTable.data));
        this.tableAlignment = existingTable.alignment || this.lastSelectedAlignment;
        return;
      }
    }
    this.tableAlignment = 'right';
    this.resetTableModal();
  }

  resetTableModal(): void {
    this.tableRows = 3;
    this.tableCols = 3;
    this.currentTableData = this.createEmptyTable(3, 3);
    this.lastFocusedCell = null;
  }

  createEmptyTable(rows: number, cols: number): any[][] {
    const table: any[][] = [];
    for (let i = 0; i < rows; i++) {
      table[i] = [];
      for (let j = 0; j < cols; j++) table[i][j] = '';
    }
    return table;
  }

  changeTableSize(): void {
    const newRows = Math.max(1, Math.min(50, this.tableRows));
    const newCols = Math.max(1, Math.min(50, this.tableCols));
    const newTable = this.createEmptyTable(newRows, newCols);
    for (let i = 0; i < Math.min(this.currentTableData.length, newRows); i++) {
      for (let j = 0; j < Math.min(this.currentTableData[i]?.length || 0, newCols); j++) {
        newTable[i][j] = this.currentTableData[i][j];
      }
    }
    this.currentTableData = newTable;
    this.tableRows = newRows;
    this.tableCols = newCols;
    setTimeout(() => this.restoreFocus(), 50);
  }

  saveTable(): void {
    if (!this.currentTableData || this.currentTableData.length === 0) {
      Swal.fire({ icon: 'error', title: 'خطأ', text: 'الجدول فارغ!', timer: 1500 });
      return;
    }
    this.lastSelectedAlignment = this.tableAlignment;
    const tableHTML = this.generateTableHTML(this.currentTableData, this.tableAlignment);
    const tableData = {
      rows: this.tableRows, cols: this.tableCols,
      data: JSON.parse(JSON.stringify(this.currentTableData)),
      html: tableHTML, alignment: this.tableAlignment, isTable: true,
    };

    if (this.editingTableIndex !== null && this.editingTableIndex >= 0) {
      this.tablesArray[this.editingTableIndex] = tableData;
    } else {
      this.tablesArray.push(tableData);
    }
    this.updateTablesFormArray();
    this.closeTableModal();
    Swal.fire({ icon: 'success', title: 'تم إضافة الجدول بنجاح', timer: 1500, showConfirmButton: false });
  }

  generateTableHTML(data: any[][], alignment: string = 'right'): string {
    if (!data || data.length === 0) return '<p>جدول فارغ</p>';
    let html = `<div class="table-responsive" dir="rtl"><table class="table table-bordered table-hover decision-table" style="width: 100%; border-collapse: collapse; margin: 10px 0;"><tbody>`;
    data.forEach((row) => {
      html += '<tr>';
      row.forEach((cell) => {
        html += `<td style="border: 1px solid #dee2e6; padding: 8px; text-align: ${alignment} !important; direction: rtl;">${cell.trim() || '&nbsp;'}</td>`;
      });
      html += '</tr>';
    });
    html += `</tbody></table></div>`;
    return html;
  }

  getExistingTable(index: number): any {
    return (index >= 0 && index < this.tablesArray.length) ? this.tablesArray[index] : null;
  }

  updateTablesFormArray(): void {
    this.tablesFormArray.clear();
    this.tablesArray.forEach(table => this.tablesFormArray.push(this.fb.control(table)));
  }

  isTableDescription(index: number): boolean {
    const tableData = this.getExistingTable(index);
    return !!tableData && (!!tableData.data?.length || !!tableData.html);
  }

  getTableContent(index: number): any {
    const tableData = this.getExistingTable(index);
    if (!tableData) return this.tablesArray[index]?.html || '';

    if (!tableData.data || tableData.data.length === 0) {
      return this.sanitizer.bypassSecurityTrustHtml(tableData.html || '');
    }
    return this.sanitizer.bypassSecurityTrustHtml(this.generateTableHTML(tableData.data, tableData.alignment || 'right'));
  }

  getTableNumber(index: number): number { return index + 1; }

  canEditTable(index: number): boolean {
    const table = this.getExistingTable(index);
    return !!table && !!table.data && table.data.length > 0;
  }

  viewTable(index: number): void {
    const table = this.tablesArray[index];
    if (!table || (!table.data && !table.html)) {
      this.showWarning('الجدول فارغ أو غير موجود');
      return;
    }
    const html = table.html || this.generateTableHTML(table.data, table.alignment || 'right');
    Swal.fire({ title: `الجدول ${index + 1}`, html: html, width: '90%', confirmButtonText: 'حسناً', showCloseButton: true });
  }

  editTable(index: number): void {
    this.openTableModal(index);
  }

  removeTable(index: number): void {
    Swal.fire({
      title: 'تأكيد الحذف', text: 'هل تريد حذف هذا الجدول؟', icon: 'warning',
      showCancelButton: true, confirmButtonText: 'نعم', cancelButtonText: 'إلغاء', reverseButtons: true
    }).then((result) => {
      if (result.isConfirmed) {
        this.tablesArray.splice(index, 1);
        this.updateTablesFormArray();
        Swal.fire({ icon: 'success', title: 'تم حذف الجدول', timer: 1500, showConfirmButton: false });
      }
    });
  }

  updateCellValue(rowIndex: number, colIndex: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    if (this.currentTableData[rowIndex] && this.currentTableData[rowIndex][colIndex] !== undefined) {
      this.currentTableData[rowIndex][colIndex] = input.value;
    }
    this.lastFocusedCell = { row: rowIndex, col: colIndex };
  }

  trackFocus(rowIndex: number, colIndex: number): void { this.lastFocusedCell = { row: rowIndex, col: colIndex }; }
  restoreFocus(): void {
    if (this.lastFocusedCell) document.getElementById(`cell-${this.lastFocusedCell.row}-${this.lastFocusedCell.col}`)?.focus();
    else this.focusFirstCell();
  }
  focusFirstCell(): void { document.getElementById('cell-0-0')?.focus(); }
  closeTableModal(): void { this.showTableModal = false; this.editingTableIndex = null; this.lastFocusedCell = null; this.resetTableModal(); }
  trackByRow(index: number, row: any[]): any { return index; }
  trackByCell(index: number, cell: any): any { return index; }
  trackByIndex(index: number): number { return index; }

  // ==================== وظائف PDF ====================
  generateTestingPdf(): void {
    if (this.form.invalid) { this.showValidationErrors(); return; }
    this.pdfGenerating = true;
    const fullContent = this.prepareFullContentForPDF();
    const activityData = {
      activityTitle: this.form.get('activityTitle')?.value,
      activityDescription: fullContent,
      mainCriteriaName: this.mainCriteria.find(mc => mc._id === this.form.get('MainCriteria')?.value)?.name || '',
      subCriteriaName: this.subCriteria.find(sc => sc._id === this.form.get('SubCriteria')?.value)?.name || '',
      userName: this.form.get('name')?.value || localStorage.getItem('fullname') || '',
      name: this.form.get('name')?.value || localStorage.getItem('fullname') || '',
      date: new Date().toISOString(),
      attachments: [...this.existingAttachments],
      tables: this.tablesArray
    };
    this.activityService.generateTestingPDF(activityData).subscribe({
      next: (res) => {
        this.pdfGenerating = false;
        if (res.success && res.fileName) {
          let filename = res.fileName;
          if (res.filePath) {
            const pathParts = res.filePath.split('/');
            filename = pathParts[pathParts.length - 1];
            if (res.filePath.includes('/testing/')) filename = `testing/${filename}`;
          }
          this.savePdfFilename(filename);
          this.showSuccess('تم إنشاء PDF التجريبي بنجاح');
        } else { this.showError(res.message || 'حدث خطأ'); }
      },
      error: (err) => { this.pdfGenerating = false; this.showError('فشل إنشاء الـ PDF: ' + err.message); }
    });
  }

  private prepareFullContentForPDF(): string {
    let fullContent = '';
    if (this.descriptionEditor?.quillEditor) fullContent = this.descriptionEditor.quillEditor.root.innerHTML;
    else fullContent = this.form.get('activityDescription')?.value || '';

    this.tablesArray.forEach((table, index) => {
      const tableHtml = table.html || this.generateTableHTML(table.data, table.alignment || 'right');
    });
    return fullContent;
  }

  openPdfTesting(): void {
    if (!this.pdfFilename) { this.showWarning('لا يوجد ملف PDF', 'يرجى الإنشاء أولاً'); return; }
    this.pdfLoading = true;
    let fullFilename = this.pdfFilename;
    if (!fullFilename.startsWith('testing/') && fullFilename.startsWith('تقرير_انجاز_تجريبي')) fullFilename = `testing/${fullFilename}`;
    this.activityService.viewPDF(fullFilename).subscribe({
      next: (blob: Blob) => { this.pdfLoading = false; window.open(URL.createObjectURL(blob), '_blank'); },
      error: () => { this.pdfLoading = false; window.open(environment.baseUrl + '/generated-files/' + fullFilename, '_blank'); }
    });
  }

  downloadPdf(): void {
    if (!this.pdfFilename) return;
    let fullFilename = this.pdfFilename;
    if (!fullFilename.startsWith('testing/') && fullFilename.startsWith('تقرير_انجاز_تجريبي')) fullFilename = `testing/${fullFilename}`;
    this.activityService.downloadPDF(fullFilename, this.generateDownloadName());
  }

  private savePdfFilename(filename: string): void {
    if (filename) {
      if (!filename.includes('/testing/') && filename.startsWith('تقرير_انجاز_تجريبي')) this.pdfFilename = `testing/${filename}`;
      else this.pdfFilename = filename;
      localStorage.setItem('lastPdfFilename', this.pdfFilename);
    }
  }

  private generateDownloadName(): string {
    const title = this.form.get('activityTitle')?.value?.replace(/[^\w\u0600-\u06FF]/g, '_') || 'انجاز';
    return `انجاز_تجريبي_${title}_${new Date().toISOString().split('T')[0]}.pdf`;
  }

  // ==================== الحفظ والإرسال ====================
  submitForReview() {
    this.markAllFieldsAsTouched();
    if (this.form.invalid) { this.showValidationErrors(); return; }
    this.isEditing ? this.updateDraft('قيد المراجعة', 'مكتمل') : this.addNewActivity('قيد المراجعة', 'مكتمل');
  }

  saveAsDraft() {
    if (this.form.get('activityTitle')?.invalid) { this.showWarning('العنوان مطلوب.'); return; }
    this.isEditing ? this.updateDraft('قيد المراجعة', 'مسودة') : this.addNewActivity('قيد المراجعة', 'مسودة');
  }

  private addNewActivity(status: string, saveStatus: string) {
    const payload = this.createFormData(status, saveStatus);
    Swal.fire({ title: 'جاري الحفظ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    this.activityService.addActivity(payload).subscribe({
      next: (response: any) => {
        Swal.close();
        if (response?.success) this.showSuccess(saveStatus === 'مسودة' ? 'تم حفظ المسودة' : 'تم الإرسال للمراجعة').then(() => this.cleanupForm());
        else this.showError(response?.message || 'خطأ أثناء الحفظ.');
      },
      error: (err) => { Swal.close(); this.showError(err?.error?.message || 'خطأ أثناء الحفظ.'); }
    });
  }

  private updateDraft(status: string, saveStatus: string) {
    if (!this.draftId) { this.showError('لم يتم العثور على معرف المسودة.'); return; }
    const payload = this.createFormData(status, saveStatus);
    Swal.fire({ title: 'جاري التحديث...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    this.activityService.updateDraftActivity(this.draftId, payload).subscribe({
      next: (response: any) => {
        Swal.close();
        if (response?.success) this.showSuccess(saveStatus === 'مسودة' ? 'تم تحديث المسودة' : 'تم الإرسال للمراجعة').then(() => { localStorage.removeItem('editingDraft'); this.router.navigate(['/drafts']); });
        else this.showError(response?.message || 'خطأ أثناء التحديث.');
      },
      error: (err) => { Swal.close(); this.showError(err?.error?.message || 'خطأ أثناء التحديث.'); }
    });
  }

private createFormData(status: string, saveStatus: string): FormData {
  const payload = new FormData();
  payload.append('activityTitle', this.form.value.activityTitle);

  const descriptionsArray: string[] = [];

  let htmlDescription = '';
  if (this.descriptionEditor?.quillEditor) {
    htmlDescription = this.descriptionEditor.quillEditor.root.innerHTML;
  }

  const isEditorEmpty = !htmlDescription || htmlDescription === '<p><br></p>' || htmlDescription.trim() === '' || htmlDescription === '<p></p>';

  if (!isEditorEmpty) {
    descriptionsArray.push(htmlDescription);
  }

  if (this.tablesArray && this.tablesArray.length > 0) {
    this.tablesArray.forEach((table) => {
      const tableHtml = table.html || this.generateTableHTML(table.data, table.alignment || 'right');
      descriptionsArray.push(tableHtml);
    });
  }

  payload.append('activityDescription', JSON.stringify(descriptionsArray));

  payload.append('MainCriteria', this.form.value.MainCriteria);
  payload.append('SubCriteria', this.form.value.SubCriteria);
  payload.append('status', status);
  payload.append('SaveStatus', saveStatus);

  const userId = localStorage.getItem('userId');
  if (userId) payload.append('user', userId);

  payload.append('name', this.form.value.name || localStorage.getItem('fullname') || '');

  // ✅ رفع ملفات جديدة — multer field "Attachments"
  this.attachments.forEach((file) => payload.append('Attachments', file, file.name));

  // ✅ ابعت المحذوفة للباك عشان يشيلها
  this.deletedAttachments.forEach((del) => payload.append('deletedAttachments', del));

  if (this.isEditing && this.draftId) payload.append('draftId', this.draftId);

  return payload;
}

  private markAllFieldsAsTouched(): void {
    Object.keys(this.form.controls).forEach((key) => this.form.get(key)?.markAsTouched());
  }

  private showValidationErrors(): void {
    const errors: string[] = [];
    if (this.form.get('activityTitle')?.invalid) errors.push('• العنوان مطلوب');
    if (this.form.get('activityDescription')?.invalid) errors.push('• الوصف مطلوب (10 أحرف على الأقل)');
    if (this.form.get('MainCriteria')?.invalid) errors.push('• المعيار الرئيسي مطلوب');
    if (this.form.get('SubCriteria')?.invalid) errors.push('• المعيار الفرعي مطلوب');
    Swal.fire({ title: 'بيانات ناقصة', html: errors.join('<br>'), icon: 'warning' });
  }

  cancel() {
    Swal.fire({ title: 'تأكيد الإلغاء', icon: 'question', showCancelButton: true, confirmButtonText: 'نعم', cancelButtonText: 'إلغاء', reverseButtons: true })
      .then((r) => { if (r.isConfirmed) this.cleanupForm(); });
  }

  private cleanupForm() {
    localStorage.removeItem('editingDraft'); localStorage.removeItem('lastPdfFilename');
    this.pdfFilename = null; this.router.navigate(['/achievements']);
  }

  resetForm() {
    this.form.reset();
    if (this.descriptionEditor?.quillEditor) this.descriptionEditor.quillEditor.root.innerHTML = '';
    this.attachments = []; this.existingAttachments = []; this.deletedAttachments = [];
    this.subCriteria = []; this.selectedMain = ''; this.isEditing = false;
    this.draftId = ''; this.originalDraftData = null; this.pdfFilename = null;
    this.pdfGenerating = false; this.pdfLoading = false;
    this.tablesArray = []; this.tablesFormArray.clear();
    this.showTableModal = false; this.editingTableIndex = null;
    this.tableAlignment = 'right'; this.lastSelectedAlignment = 'right';
  }

  ngOnDestroy(): void { localStorage.removeItem('lastPdfFilename'); }

  // ==================== المرفقات ====================
  getFileName(url: string): string { return url ? url.split('/').pop() || 'ملف' : 'ملف'; }
  getFileType(url: string): string { const ext = url?.split('.').pop()?.toLowerCase() || ''; return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext) ? 'صورة' : 'ملف'; }
  isImage(url: string): boolean { return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(url?.split('.').pop()?.toLowerCase() || ''); }
  isImageFile(file: File): boolean { return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(file?.name.split('.').pop()?.toLowerCase() || ''); }
  getFullAttachmentUrl(path: string): string { if (!path) return ''; if (path.startsWith('http')) return path; return `http://localhost:3000/${path.startsWith('/') ? '' : 'uploads/'}${path}`; }
  getFilePreview(file: File): string { return this.isImageFile(file) ? URL.createObjectURL(file) : ''; }
  viewAttachment(url: string): void { window.open(this.getFullAttachmentUrl(url), '_blank'); }

  onFilesSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    if (!input.files) return;
    const files = Array.from(input.files);
    if (this.attachments.length + files.length + this.existingAttachments.length > this.maxFiles) {
      this.showWarning(`الحد الأقصى ${this.maxFiles} ملفات فقط.`); return;
    }
    for (const f of files) {
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      if (!['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext)) { this.showError('نوع ملف غير مدعوم.'); continue; }
      if (f.size / (1024 * 1024) > this.maxFileSizeMB) { this.showError(`حجم الملف أكبر من ${this.maxFileSizeMB}MB.`); continue; }
      this.attachments.push(f);
    }
    input.value = '';
  }

  removeAttachment(index: number) { this.attachments.splice(index, 1); }
  removeExistingAttachment(index: number) {
    Swal.fire({ title: 'تأكيد الحذف', icon: 'warning', showCancelButton: true, confirmButtonText: 'نعم', cancelButtonText: 'إلغاء', reverseButtons: true })
      .then((r) => { if (r.isConfirmed) { this.deletedAttachments.push(this.existingAttachments[index]); this.existingAttachments.splice(index, 1); } });
  }

  // ==================== الرسائل ====================
  private showSuccess(message: string): Promise<any> { return Swal.fire({ title: 'تم', text: message, icon: 'success' }); }
  private showError(message: string): void { Swal.fire({ title: 'خطأ', text: message, icon: 'error' }); }
  private showWarning(title: string, text?: string): void { Swal.fire({ title, text, icon: 'warning' }); }

  // ==================== الخطوط ====================
  private injectQuillFontStyles(): void {
    const styleId = 'quill-custom-fonts';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&family=Tajawal:wght@400;700&family=Amiri:wght@400;700&family=Noto+Naskh+Arabic:wght@400;700&family=Reem+Kufi:wght@400;700&family=Lateef&family=Scheherazade+New:wght@400;700&family=Rakkas&family=Mada:wght@400;700&family=IBM+Plex+Arabic:wght@400;700&family=Harmattan:wght@400;700&family=Markazi+Text:wght@400;700&family=Aref+Ruqaa&family=El+Messiri:wght@400;700&family=Jomhuria&family=Mirza:wght@400;700&family=Katibeh&family=Lalezar&display=swap');
      .ql-font-cairo, .ql-editor .ql-font-cairo { font-family: 'Cairo', sans-serif !important; }
      .ql-font-tajawal, .ql-editor .ql-font-tajawal { font-family: 'Tajawal', sans-serif !important; }
      .ql-font-amiri, .ql-editor .ql-font-amiri { font-family: 'Amiri', serif !important; }
      .ql-font-noto-naskh, .ql-editor .ql-font-noto-naskh { font-family: 'Noto Naskh Arabic', serif !important; }
      .ql-font-reem-kufi, .ql-editor .ql-font-reem-kufi { font-family: 'Reem Kufi', sans-serif !important; }
      .ql-font-lateef, .ql-editor .ql-font-lateef { font-family: 'Lateef', serif !important; }
      .ql-font-scheherazade, .ql-editor .ql-font-scheherazade { font-family: 'Scheherazade New', serif !important; }
      .ql-font-rakkas, .ql-editor .ql-font-rakkas { font-family: 'Rakkas', cursive !important; }
      .ql-font-mada, .ql-editor .ql-font-mada { font-family: 'Mada', sans-serif !important; }
      .ql-font-ibm-plex-arabic, .ql-editor .ql-font-ibm-plex-arabic { font-family: 'IBM Plex Arabic', sans-serif !important; }
      .ql-font-harmattan, .ql-editor .ql-font-harmattan { font-family: 'Harmattan', sans-serif !important; }
      .ql-font-markazi, .ql-editor .ql-font-markazi { font-family: 'Markazi Text', serif !important; }
      .ql-font-aref-ruqaa, .ql-editor .ql-font-aref-ruqaa { font-family: 'Aref Ruqaa', serif !important; }
      .ql-font-el-messiri, .ql-editor .ql-font-el-messiri { font-family: 'El Messiri', sans-serif !important; }
      .ql-font-jomhuria, .ql-editor .ql-font-jomhuria { font-family: 'Jomhuria', serif !important; }
      .ql-font-mirza, .ql-editor .ql-font-mirza { font-family: 'Mirza', cursive !important; }
      .ql-font-katibeh, .ql-editor .ql-font-katibeh { font-family: 'Katibeh', serif !important; }
      .ql-font-lalezar, .ql-editor .ql-font-lalezar { font-family: 'Lalezar', cursive !important; }
      .ql-snow .ql-picker.ql-font { width: 160px !important; }
      .ql-snow .ql-picker.ql-size { width: 80px !important; }
    `;
    document.head.appendChild(style);
  }

  // ==================== معاينة الخطوط والأحجام ====================

  showFontsPreview(): void {
    const fontNames: { [key: string]: string } = {
      'cairo': 'Cairo (كايرو)',
      'tajawal': 'Tajawal (تجوال)',
      'amiri': 'Amiri (أميري)',
      'noto-naskh': 'Noto Naskh Arabic',
      'reem-kufi': 'Reem Kufi',
      'lateef': 'Lateef (لطيف)',
      'scheherazade': 'Scheherazade New',
      'rakkas': 'Rakkas (رقاع)',
      'mada': 'Mada (مادة)',
      'ibm-plex-arabic': 'IBM Plex Arabic',
      'harmattan': 'Harmattan (حرمتان)',
      'markazi': 'Markazi Text (مركزي)',
      'aref-ruqaa': 'Aref Ruqaa (عريض الرقاع)',
      'el-messiri': 'El Messiri (المسيري)',
      'jomhuria': 'Jomhuria (جمهورية)',
      'mirza': 'Mirza (ميرزا)',
      'katibeh': 'Katibeh (كاتبة)',
      'lalezar': 'Lalezar (لالزار)',
      'serif': 'Serif',
      'monospace': 'Monospace',
      'arial': 'Arial',
      'times-new-roman': 'Times New Roman'
    };

    let htmlContent = '<div style="text-align: right; direction: rtl; max-height: 500px; overflow-y: auto;">';
    htmlContent += '<h5 style="color: #333; margin-bottom: 20px;">📝 معاينة الخطوط المتاحة</h5>';

    this.fontWhitelist.forEach(font => {
      if (font) {
        const fontName = fontNames[font] || font;
        const fontFamily = this.getFontFamily(font);
        htmlContent += `
          <div style="
            padding: 12px;
            margin-bottom: 10px;
            background: #f8f9fa;
            border-radius: 4px;
            border-left: 3px solid #007bff;
          ">
            <strong style="color: #333; font-size: 14px;">${fontName}</strong>
            <div style="
              font-family: ${fontFamily};
              font-size: 18px;
              color: #555;
              margin-top: 8px;
              padding: 10px;
              background: white;
              border-radius: 4px;
            ">
              هذا نص عينة في خط ${fontName}
            </div>
          </div>
        `;
      }
    });

    htmlContent += '</div>';

    Swal.fire({
      title: '🎨 معاينة الخطوط',
      html: htmlContent,
      width: '600px',
      confirmButtonText: 'حسناً'
    });
  }

  showSizesPreview(): void {
    let htmlContent = '<div style="text-align: right; direction: rtl; max-height: 400px; overflow-y: auto;">';
    htmlContent += '<h5 style="color: #333; margin-bottom: 20px;">📏 معاينة أحجام الخطوط</h5>';

    this.sizeWhitelist.forEach(size => {
      const sizeNum = parseInt(size);
      htmlContent += `
        <div style="
          padding: 12px;
          margin-bottom: 10px;
          background: #f8f9fa;
          border-radius: 4px;
          border-left: 3px solid #28a745;
        ">
          <strong style="color: #333;">${size}</strong>
          <div style="
            font-size: ${size};
            color: #555;
            margin-top: 8px;
            padding: 8px;
            background: white;
            border-radius: 4px;
            font-family: 'Cairo', sans-serif;
          ">
            نص عينة بحجم ${sizeNum}px
          </div>
        </div>
      `;
    });

    htmlContent += '</div>';

    Swal.fire({
      title: '📏 معاينة أحجام الخطوط',
      html: htmlContent,
      width: '500px',
      confirmButtonText: 'حسناً'
    });
  }

  showAllAvailableOptions(): void {
    const fontNames: { [key: string]: string } = {
      'cairo': 'Cairo',
      'tajawal': 'Tajawal',
      'amiri': 'Amiri',
      'noto-naskh': 'Noto Naskh Arabic',
      'reem-kufi': 'Reem Kufi',
      'lateef': 'Lateef',
      'scheherazade': 'Scheherazade New',
      'rakkas': 'Rakkas',
      'mada': 'Mada',
      'ibm-plex-arabic': 'IBM Plex Arabic',
      'harmattan': 'Harmattan',
      'markazi': 'Markazi Text',
      'aref-ruqaa': 'Aref Ruqaa',
      'el-messiri': 'El Messiri',
      'jomhuria': 'Jomhuria',
      'mirza': 'Mirza',
      'katibeh': 'Katibeh',
      'lalezar': 'Lalezar',
      'serif': 'Serif',
      'monospace': 'Monospace',
      'arial': 'Arial',
      'times-new-roman': 'Times New Roman'
    };

    let htmlContent = '<div style="text-align: right; direction: rtl; max-height: 600px; overflow-y: auto;">';
    htmlContent += `
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <thead>
          <tr style="background: #007bff; color: white;">
            <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">الخط</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">الأحجام المتاحة</th>
          </tr>
        </thead>
        <tbody>
    `;

    this.fontWhitelist.forEach((font, index) => {
      if (font) {
        const fontName = fontNames[font] || font;
        const bgColor = index % 2 === 0 ? '#f9f9f9' : 'white';
        htmlContent += `
          <tr style="background: ${bgColor};">
            <td style="padding: 10px; border: 1px solid #ddd; color: #333; font-weight: 500;">${fontName}</td>
            <td style="padding: 10px; border: 1px solid #ddd;">
              ${this.sizeWhitelist.join(', ')}
            </td>
          </tr>
        `;
      }
    });

    htmlContent += `
        </tbody>
      </table>
    </div>
    `;

    Swal.fire({
      title: '📋 جميع الخيارات المتاحة',
      html: htmlContent,
      width: '800px',
      confirmButtonText: 'حسناً'
    });
  }

  exportFontsAndSizesAsText(): void {
    let textContent = '===== قائمة الخطوط والأحجام المتاحة =====\n\n';

    const fontNames: { [key: string]: string } = {
      'cairo': 'Cairo (كايرو)',
      'tajawal': 'Tajawal (تجوال)',
      'amiri': 'Amiri (أميري)',
      'noto-naskh': 'Noto Naskh Arabic',
      'reem-kufi': 'Reem Kufi',
      'lateef': 'Lateef (لطيف)',
      'scheherazade': 'Scheherazade New',
      'rakkas': 'Rakkas (رقاع)',
      'mada': 'Mada (مادة)',
      'ibm-plex-arabic': 'IBM Plex Arabic',
      'harmattan': 'Harmattan (حرمتان)',
      'markazi': 'Markazi Text (مركزي)',
      'aref-ruqaa': 'Aref Ruqaa (عريض الرقاع)',
      'el-messiri': 'El Messiri (المسيري)',
      'jomhuria': 'Jomhuria (جمهورية)',
      'mirza': 'Mirza (ميرزا)',
      'katibeh': 'Katibeh (كاتبة)',
      'lalezar': 'Lalezar (لالزار)',
      'serif': 'Serif',
      'monospace': 'Monospace',
      'arial': 'Arial',
      'times-new-roman': 'Times New Roman'
    };

    textContent += '📝 الخطوط المتاحة:\n';
    textContent += '-'.repeat(50) + '\n';
    this.fontWhitelist.forEach((font, index) => {
      if (font) {
        textContent += `${index + 1}. ${fontNames[font] || font}\n`;
      }
    });

    textContent += '\n📏 أحجام الخطوط المتاحة:\n';
    textContent += '-'.repeat(50) + '\n';
    this.sizeWhitelist.forEach((size, index) => {
      textContent += `${index + 1}. ${size}\n`;
    });

    textContent += '\n' + '='.repeat(50) + '\n';
    textContent += `تم إنشاء القائمة في: ${new Date().toLocaleString('ar-EG')}\n`;

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(textContent));
    element.setAttribute('download', `fonts-sizes-list-${Date.now()}.txt`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    this.showSuccess('تم تصدير القائمة بنجاح');
  }

  private getFontFamily(fontName: string): string {
    const fontMap: { [key: string]: string } = {
      'cairo': "'Cairo', sans-serif",
      'tajawal': "'Tajawal', sans-serif",
      'amiri': "'Amiri', serif",
      'noto-naskh': "'Noto Naskh Arabic', serif",
      'reem-kufi': "'Reem Kufi', sans-serif",
      'lateef': "'Lateef', serif",
      'scheherazade': "'Scheherazade New', serif",
      'rakkas': "'Rakkas', cursive",
      'mada': "'Mada', sans-serif",
      'ibm-plex-arabic': "'IBM Plex Arabic', sans-serif",
      'harmattan': "'Harmattan', sans-serif",
      'markazi': "'Markazi Text', serif",
      'aref-ruqaa': "'Aref Ruqaa', serif",
      'el-messiri': "'El Messiri', sans-serif",
      'jomhuria': "'Jomhuria', serif",
      'mirza': "'Mirza', cursive",
      'katibeh': "'Katibeh', serif",
      'lalezar': "'Lalezar', cursive",
      'serif': 'serif',
      'monospace': 'monospace',
      'arial': 'Arial, sans-serif',
      'times-new-roman': "'Times New Roman', serif"
    };
    return fontMap[fontName] || fontName;
  }
}