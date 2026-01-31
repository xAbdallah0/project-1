import {
  Component,
  ElementRef,
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

@Component({
  selector: 'app-add-achievement',
  templateUrl: './add-achievement.component.html',
  styleUrls: ['./add-achievement.component.css'],
})
export class AddAchievementComponent implements OnInit {
  @ViewChild('descriptionEditor', { static: true })
  descriptionEditor!: ElementRef<HTMLDivElement>;

  // متغيرات النموذج الأساسية
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

  // متغيرات الجداول
  showTableModal = false;
  tableRows = 1;
  tableCols = 2;
  currentTableData: any[][] = [];
  editingTableIndex: number | null = null;
  tablesArray: any[] = [];
  private lastFocusedCell: { row: number, col: number } | null = null;

  // متغيرات PDF Testing
  pdfGenerating = false;
  pdfLoading = false;
  pdfFilename: string | null = null;

  // متغيرات التنسيق
  isBold = false;
  isItalic = false;
  isUnderline = false;

  constructor(
    private fb: FormBuilder,
    private criteriaService: CriteriaService,
    private activityService: ActivityService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.checkViewport();
    this.initializeForm();
    this.loadMainCriteria();
    this.checkEditMode();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.checkViewport();
  }

  private checkViewport(): void {
    this.isMobileView = window.innerWidth < 992;
  }

  // ==================== وظائف النموذج الأساسية ====================

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
    console.log('Loading draft data...');
    console.log('draftId:', this.draftId);

    const savedDraft = localStorage.getItem('editingDraft');

    if (savedDraft) {
      try {
        this.originalDraftData = JSON.parse(savedDraft);
        console.log('Parsed draft data:', this.originalDraftData);
        this.populateFormWithDraftData();
      } catch (error) {
        console.error('Error parsing draft data:', error);
        this.showError('حدث خطأ في تحميل بيانات المسودة');
      }
    } else {
      console.warn('No draft data found in localStorage');
      this.showWarning('لم يتم العثور على بيانات المسودة');
    }
  }

  populateFormWithDraftData(): void {
    if (this.originalDraftData && this.form) {
      console.log('Populating form with draft data...');
      console.log('Original draft tables:', this.originalDraftData.tables);

      // تحميل البيانات الأساسية
      this.form.patchValue({
        activityTitle: this.originalDraftData.activityTitle,
        activityDescription: this.originalDraftData.activityDescription || this.extractPlainText(this.originalDraftData.activityDescription),
        MainCriteria:
          this.originalDraftData.MainCriteria?._id ||
          this.originalDraftData.MainCriteria,
        SubCriteria:
          this.originalDraftData.SubCriteria?._id ||
          this.originalDraftData.SubCriteria,
        name: this.originalDraftData.name,
      });

      // تحميل المرفقات الحالية
      if (
        this.originalDraftData.Attachments &&
        Array.isArray(this.originalDraftData.Attachments)
      ) {
        this.existingAttachments = [...this.originalDraftData.Attachments];
        console.log('Loaded existing attachments:', this.existingAttachments);
      } else {
        this.existingAttachments = [];
      }

      // تحميل الجداول الحالية
      this.tablesArray = [];

      if (this.originalDraftData.tables) {
        console.log('Processing draft tables...');

        let tablesData = this.originalDraftData.tables;

        // إذا كانت tables نصية (JSON)، نحولها إلى مصفوفة
        if (typeof tablesData === 'string') {
          try {
            tablesData = JSON.parse(tablesData);
            console.log('Parsed tables JSON:', tablesData);
          } catch (e) {
            console.error('Error parsing tables JSON:', e);
            tablesData = [];
          }
        }

        // التأكد من أن tablesData هي مصفوفة
        if (Array.isArray(tablesData) && tablesData.length > 0) {
          this.tablesArray = [...tablesData];
          console.log('Loaded tables to tablesArray:', this.tablesArray);
        }
      } else {
        console.log('No tables found in draft data');
      }

      // تحديث FormArray للجداول
      this.updateTablesFormArray();
      console.log('tablesFormArray after update:', this.tablesFormArray.value);

      // تحميل النص في المحرر (النص فقط بدون جداول)
      if (this.descriptionEditor) {
        // إزالة أي جداول من النص القديم
        let textOnly = this.originalDraftData.activityDescription || '';

        // إزالة أي HTML للجداول قد يكون موجوداً في النص القديم
        textOnly = textOnly.replace(/<table[\s\S]*?<\/table>/gi, '');
        textOnly = textOnly.replace(/<div[^>]*class=["'][^"']*table[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '');

        this.descriptionEditor.nativeElement.innerHTML = textOnly || '';
        this.syncDescriptionToForm();
      }

      // تحميل المعيار الرئيسي والفرعي
      const mainCriteriaId =
        this.originalDraftData.MainCriteria?._id ||
        this.originalDraftData.MainCriteria;
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
        activityDescription: [
          '',
          [
            Validators.required,
            Validators.minLength(10),
            Validators.maxLength(1000),
          ],
        ],
        MainCriteria: ['', Validators.required],
        SubCriteria: ['', Validators.required],
        name: [''],
        tables: this.fb.array([]),
      },
      { updateOn: 'change' }
    );
  }

  get tablesFormArray(): FormArray {
    return this.form.get('tables') as FormArray;
  }

  loadMainCriteria(): void {
    this.criteriaService.getAllMainCriteria().subscribe({
      next: (res: any[]) => {
        this.mainCriteria = res;
      },
      error: () => {
        this.showError('تعذر تحميل المعايير الرئيسية من الخادم.');
        this.mainCriteria = [];
      },
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
          const mcId =
            typeof sub.mainCriteria === 'string'
              ? sub.mainCriteria
              : sub.mainCriteria._id;
          return mcId === mainId;
        });
      },
      error: (err) => {
        console.error('Error loading sub-criteria:', err);
        this.showError('حدث خطأ أثناء تحميل المعايير الفرعية من الخادم.');
        this.subCriteria = [];
      },
    });
  }

  // ==================== وظائف محرر النص ====================

  exec(command: string, value?: string) {
    this.descriptionEditor.nativeElement.focus();
    document.execCommand(command, false, value);
    this.syncDescriptionToForm();
    this.updateFormatStatus();
  }

  updateFormatStatus() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const parentElement = range.commonAncestorContainer.parentElement;

    if (parentElement) {
      this.isBold = parentElement.tagName === 'B' || parentElement.tagName === 'STRONG' ||
                   window.getComputedStyle(parentElement).fontWeight === 'bold' ||
                   parentElement.style.fontWeight === 'bold';

      this.isItalic = parentElement.tagName === 'I' || parentElement.tagName === 'EM' ||
                     window.getComputedStyle(parentElement).fontStyle === 'italic' ||
                     parentElement.style.fontStyle === 'italic';

      this.isUnderline = parentElement.tagName === 'U' ||
                        window.getComputedStyle(parentElement).textDecoration.includes('underline') ||
                        parentElement.style.textDecoration.includes('underline');
    }
  }

  syncDescriptionToForm() {
    let htmlContent = this.descriptionEditor.nativeElement.innerHTML || '';
    const plainText = this.extractPlainText(htmlContent);

    this.form.get('activityDescription')?.setValue(plainText);

    if (plainText.length < 10) {
      this.form.get('activityDescription')?.setErrors({ minlength: true });
    } else if (plainText.length > 1000) {
      this.form.get('activityDescription')?.setErrors({ maxlength: true });
    } else {
      this.form.get('activityDescription')?.setErrors(null);
    }

    this.form.get('activityDescription')?.markAsTouched();
  }

  private extractPlainText(html: string): string {
    if (!html) return '';

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    const text = tempDiv.textContent || tempDiv.innerText || '';
    return this.cleanText(text);
  }

  private cleanText(text: string): string {
    if (!text) return '';

    return (
      text
        .replace(
          /[\r\n\t\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]+/g,
          ' '
        )
        .replace(/\s+/g, ' ')
        .replace(/^\s+/, '')
        .replace(/\s+$/, '')
        .normalize('NFKC')
        .replace(
          /[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0020-\u007E\u00A0-\u00FF\u0100-\u017F\u0180-\u024F\u1E00-\u1EFF]/g,
          ''
        )
        .trim()
    );
  }

  getDescriptionLength(): number {
    const description = this.form.get('activityDescription')?.value;
    if (!description) return 0;
    return description.length;
  }

  // ==================== وظائف الجداول المنفصلة ====================

  openTableModal(descriptionIndex?: number): void {
    this.showTableModal = true;
    this.editingTableIndex = descriptionIndex !== undefined ? descriptionIndex : null;

    if (descriptionIndex !== undefined && descriptionIndex !== null) {
      const existingTable = this.getExistingTable(descriptionIndex);
      if (existingTable) {
        this.tableRows = existingTable.rows;
        this.tableCols = existingTable.cols;
        this.currentTableData = JSON.parse(JSON.stringify(existingTable.data));
      } else {
        this.resetTableModal();
      }
    } else {
      this.resetTableModal();
    }

    setTimeout(() => {
      this.focusFirstCell();
    }, 100);
  }

  resetTableModal(): void {
    this.tableRows = 1;
    this.tableCols = 2;
    this.currentTableData = this.createEmptyTable(1, 2);
    this.lastFocusedCell = null;
  }

  createEmptyTable(rows: number, cols: number): any[][] {
    const table: any[][] = [];
    for (let i = 0; i < rows; i++) {
      table[i] = [];
      for (let j = 0; j < cols; j++) {
        table[i][j] = '';
      }
    }
    return table;
  }

  changeTableSize(): void {
    const newRows = Math.max(1, Math.min(20, this.tableRows));
    const newCols = Math.max(1, Math.min(10, this.tableCols));

    const newTable = this.createEmptyTable(newRows, newCols);

    for (let i = 0; i < Math.min(this.currentTableData.length, newRows); i++) {
      for (let j = 0; j < Math.min(this.currentTableData[0]?.length || 0, newCols); j++) {
        newTable[i][j] = this.currentTableData[i][j];
      }
    }

    this.currentTableData = newTable;
    this.tableRows = newRows;
    this.tableCols = newCols;

    setTimeout(() => {
      this.restoreFocus();
    }, 50);
  }

  saveTable(): void {
    if (!this.currentTableData || this.currentTableData.length === 0) {
      this.showError('الجدول فارغ');
      return;
    }

    const tableData = {
      rows: this.tableRows,
      cols: this.tableCols,
      data: this.currentTableData,
      html: this.generateTableHTML(this.currentTableData),
      title: `جدول ${this.tablesArray.length + 1}`
    };

    if (this.editingTableIndex !== null && this.editingTableIndex >= 0) {
      this.tablesArray[this.editingTableIndex] = tableData;
    } else {
      this.tablesArray.push(tableData);
    }

    this.updateTablesFormArray();
    this.closeTableModal();
    this.showSuccess('تم حفظ الجدول بنجاح');
  }

  generateTableHTML(data: any[][]): string {
    if (!data || data.length === 0) {
      return '<p>جدول فارغ</p>';
    }

    let html = `
      <div class="table-responsive" dir="rtl" style="margin: 15px 0; border: 1px solid #dee2e6; border-radius: 4px; overflow: hidden;">
        <table class="table table-bordered mb-0" style="margin: 0;">
          <tbody>`;

    data.forEach((row) => {
      html += '<tr>';
      row.forEach((cell) => {
        const cellContent = cell || '&nbsp;';
        html += `<td style="padding: 8px; border: 1px solid #dee2e6; text-align: right;">${cellContent}</td>`;
      });
      html += '</tr>';
    });

    html += `
          </tbody>
        </table>
      </div>`;

    return html;
  }

  getExistingTable(index: number): any {
    if (index >= 0 && index < this.tablesArray.length) {
      return this.tablesArray[index];
    }
    return null;
  }

  updateTablesFormArray(): void {
    this.tablesFormArray.clear();
    this.tablesArray.forEach(table => {
      this.tablesFormArray.push(this.fb.control(table));
    });
    console.log('Updated tablesFormArray:', this.tablesFormArray.value);
  }

  // ==================== وظائف عرض وتعديل الجداول ====================

  viewTable(index: number): void {
    const table = this.tablesArray[index];
    if (!table || !table.data) {
      this.showWarning('الجدول فارغ أو غير موجود');
      return;
    }

    Swal.fire({
      title: `عرض ${table.title || `الجدول ${index + 1}`}`,
      html: table.html || this.generateTableHTML(table.data),
      width: '90%',
      confirmButtonText: 'حسناً',
      showCloseButton: true
    });
  }

  editTable(index: number): void {
    this.openTableModal(index);
  }

  removeTable(index: number): void {
    Swal.fire({
      title: 'تأكيد الحذف',
      text: 'هل تريد حذف هذا الجدول؟',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'نعم، احذف',
      cancelButtonText: 'إلغاء',
      reverseButtons: true
    }).then((result) => {
      if (result.isConfirmed) {
        this.tablesArray.splice(index, 1);
        this.updateTablesFormArray();
        this.showSuccess('تم حذف الجدول بنجاح');
      }
    });
  }

  updateCellValue(rowIndex: number, colIndex: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;

    if (this.currentTableData[rowIndex] && this.currentTableData[rowIndex][colIndex] !== undefined) {
      this.currentTableData[rowIndex][colIndex] = value;
    }

    this.lastFocusedCell = { row: rowIndex, col: colIndex };
  }

  trackFocus(rowIndex: number, colIndex: number): void {
    this.lastFocusedCell = { row: rowIndex, col: colIndex };
  }

  restoreFocus(): void {
    if (this.lastFocusedCell) {
      const { row, col } = this.lastFocusedCell;
      const cellId = `cell-${row}-${col}`;
      const cellInput = document.getElementById(cellId);
      if (cellInput) {
        cellInput.focus();
      }
    } else {
      this.focusFirstCell();
    }
  }

  focusFirstCell(): void {
    const firstCell = document.getElementById('cell-0-0');
    if (firstCell) {
      firstCell.focus();
    }
  }

  closeTableModal(): void {
    this.showTableModal = false;
    this.editingTableIndex = null;
    this.lastFocusedCell = null;
    this.resetTableModal();
  }

  trackByRow(index: number, row: any[]): any {
    return index;
  }

  trackByCell(index: number, cell: any): any {
    return index;
  }

  // ==================== وظائف PDF Testing ====================

  generateTestingPdf(): void {
    if (this.form.invalid) {
      this.showValidationErrors();
      return;
    }

    this.pdfGenerating = true;

    const fullContent = this.prepareFullContentForPDF();

    const activityData = {
      activityTitle: this.form.get('activityTitle')?.value,
      activityDescription: fullContent,
      mainCriteriaName: this.mainCriteria.find(
        mc => mc._id === this.form.get('MainCriteria')?.value
      )?.name || '',
      subCriteriaName: this.subCriteria.find(
        sc => sc._id === this.form.get('SubCriteria')?.value
      )?.name || '',
      userName: this.form.get('name')?.value || localStorage.getItem('fullname') || 'مستخدم تجريبي',
      name: this.form.get('name')?.value || localStorage.getItem('fullname') || '',
      date: new Date().toISOString(),
      Attachments: [...this.existingAttachments],
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

            if (res.filePath.includes('/testing/')) {
              filename = `testing/${filename}`;
            }
          }

          this.savePdfFilename(filename);
          this.showSuccess('تم إنشاء PDF التجريبي بنجاح');
        } else {
          this.showError(res.message || 'حدث خطأ في إنشاء PDF');
        }
      },
      error: (err) => {
        this.pdfGenerating = false;
        this.showError('فشل إنشاء الـ PDF التجريبي: ' + err.message);
      }
    });
  }

  private prepareFullContentForPDF(): string {
    const textContent = this.descriptionEditor.nativeElement.innerHTML || '';
    let fullContent = textContent;

    this.tablesArray.forEach((table, index) => {
      fullContent += `<div style="margin: 20px 0;">
        <h4 style="text-align: right; margin-bottom: 10px; color: #333;">
          ${table.title || `جدول ${index + 1}`}
        </h4>
        ${table.html || this.generateTableHTML(table.data)}
      </div>`;
    });

    return fullContent;
  }

  openPdfTesting(): void {
    if (!this.pdfFilename) {
      this.showWarning('لا يوجد ملف PDF متاح للعرض', 'يرجى إنشاء PDF أولاً');
      return;
    }

    this.pdfLoading = true;

    let fullFilename = this.pdfFilename;
    if (!fullFilename.startsWith('testing/') && fullFilename.startsWith('تقرير_انجاز_تجريبي')) {
      fullFilename = `testing/${fullFilename}`;
    }

    this.activityService.viewPDF(fullFilename).subscribe({
      next: (blob: Blob) => {
        this.pdfLoading = false;
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      },
      error: (err: any) => {
        this.pdfLoading = false;
        const fileUrl = `http://localhost:3000/generated-files/${fullFilename}`;
        window.open(fileUrl, '_blank');
        this.showWarning('تم فتح الملف في نافذة جديدة', 'إذا لم يعمل، يرجى التحقق من المسار');
      }
    });
  }

  downloadPdf(): void {
    if (!this.pdfFilename) {
      this.showWarning('لا يوجد ملف PDF متاح للتنزيل');
      return;
    }

    const downloadName = this.generateDownloadName();
    let fullFilename = this.pdfFilename;
    if (!fullFilename.startsWith('testing/') && fullFilename.startsWith('تقرير_انجاز_تجريبي')) {
      fullFilename = `testing/${fullFilename}`;
    }

    this.activityService.downloadPDF(fullFilename, downloadName);
  }

  private savePdfFilename(filename: string): void {
    if (filename) {
      if (!filename.includes('/testing/') && filename.startsWith('تقرير_انجاز_تجريبي')) {
        this.pdfFilename = `testing/${filename}`;
      } else if (filename.includes('testing/')) {
        this.pdfFilename = filename;
      } else {
        this.pdfFilename = filename;
      }
      localStorage.setItem('lastPdfFilename', this.pdfFilename);
    }
  }

  private generateDownloadName(): string {
    const title = this.form.get('activityTitle')?.value
      ? this.form.get('activityTitle')?.value.replace(/[^\w\u0600-\u06FF]/g, '_')
      : 'انجاز';
    const date = new Date().toISOString().split('T')[0];
    return `انجاز_تجريبي_${title}_${date}.pdf`;
  }

  // ==================== وظائف الحفظ والإرسال ====================

  submitForReview() {
    this.syncDescriptionToForm();
    this.markAllFieldsAsTouched();

    if (this.form.invalid) {
      this.showValidationErrors();
      return;
    }

    if (this.isEditing) {
      this.updateDraft('قيد المراجعة', 'مكتمل');
    } else {
      this.addNewActivity('قيد المراجعة', 'مكتمل');
    }
  }

  saveAsDraft() {
    this.syncDescriptionToForm();

    if (this.form.get('activityTitle')?.invalid) {
      this.showWarning('العنوان مطلوب لحفظ المسودة.');
      return;
    }

    if (this.isEditing) {
      this.updateDraft('قيد المراجعة', 'مسودة');
    } else {
      this.addNewActivity('قيد المراجعة', 'مسودة');
    }
  }

  // دالة لضمان تحميل الجداول
  ensureTablesData(): void {
    if (this.tablesArray.length === 0 && this.originalDraftData?.tables) {
      console.log('إعادة تحميل الجداول من بيانات المسودة...');
      this.populateFormWithDraftData();
    }
  }

  private addNewActivity(status: string, saveStatus: string) {
    const payload = this.createFormData(status, saveStatus);

    Swal.fire({
      title: 'جاري الحفظ...',
      text: 'يرجى الانتظار قليلاً.',
      icon: 'info',
      showConfirmButton: false,
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    this.activityService.addActivity(payload).subscribe({
      next: (response: any) => {
        Swal.close();
        console.log('Add activity response:', response);

        if (response && response.success) {
          const message =
            saveStatus === 'مسودة'
              ? 'تم حفظ المسودة بنجاح'
              : 'تم إرسال النشاط بنجاح للمراجعة';
          this.showSuccess(message).then(() => {
            this.cleanupForm();
          });
        } else {
          this.showError(response?.message || 'حدث خطأ أثناء الحفظ.');
        }
      },
      error: (err) => {
        Swal.close();
        console.error('Add activity error:', err);
        this.showError(err?.error?.message || 'حدث خطأ أثناء الحفظ.');
      },
    });
  }

  private updateDraft(status: string, saveStatus: string) {
    console.log('=== Starting updateDraft ===');
    console.log('draftId:', this.draftId);
    console.log('isEditing:', this.isEditing);
    console.log('tablesArray:', this.tablesArray);
    console.log('Form valid:', this.form.valid);

    // التحقق من draftId
    if (!this.draftId) {
      console.error('No draftId found!');
      this.showError('لم يتم العثور على معرف المسودة.');
      return;
    }

    const payload = this.createFormData(status, saveStatus);

    // تسجيل معلومات التصحيح
    console.log('FormData created, checking payload...');

    // التحقق من محتويات FormData
    console.log('FormData keys:');
    payload.forEach((value, key) => {
      console.log(`${key}:`, value instanceof File ? `File: ${value.name}` : value);
    });

    Swal.fire({
      title: 'جاري التحديث...',
      text: 'يرجى الانتظار قليلاً.',
      icon: 'info',
      showConfirmButton: false,
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    console.log('Sending update request...');
    this.activityService.updateDraftActivity(this.draftId, payload).subscribe({
      next: (response: any) => {
        console.log('Update response:', response);
        Swal.close();

        if (response && response.success) {
          const message =
            saveStatus === 'مسودة'
              ? 'تم تحديث المسودة بنجاح'
              : 'تم إرسال النشاط بنجاح للمراجعة';

          this.showSuccess(message).then(() => {
            // تنظيف localStorage
            localStorage.removeItem('editingDraft');
            // الانتقال إلى صفحة المسودات
            this.router.navigate(['/drafts']);
          });
        } else {
          this.showError(response?.message || 'حدث خطأ أثناء التحديث.');
        }
      },
      error: (err) => {
        console.error('Update error:', err);
        Swal.close();

        let errorMessage = 'حدث خطأ أثناء التحديث.';

        if (err.status === 404) {
          errorMessage = 'لم يتم العثور على المسودة على الخادم.';
        } else if (err.status === 400) {
          errorMessage = 'بيانات غير صحيحة. يرجى التحقق من المدخلات.';
        } else if (err.status === 500) {
          errorMessage = 'خطأ في الخادم. يرجى المحاولة لاحقاً.';
        } else if (err.error?.message) {
          errorMessage = err.error.message;
        }

        this.showError(errorMessage);
      },
    });
  }

  private createFormData(status: string, saveStatus: string): FormData {
    const payload = new FormData();

    // البيانات الأساسية
    payload.append('activityTitle', this.form.value.activityTitle);
    payload.append('activityDescription', this.form.value.activityDescription);
    payload.append('MainCriteria', this.form.value.MainCriteria);
    payload.append('SubCriteria', this.form.value.SubCriteria);
    payload.append('status', status);
    payload.append('SaveStatus', saveStatus);

    const userId = localStorage.getItem('userId');
    if (userId) {
      payload.append('user', userId);
    }

    const name = this.form.value.name || localStorage.getItem('fullname') || '';
    payload.append('name', name);

    // إضافة الجداول كبيانات JSON
    if (this.tablesArray && this.tablesArray.length > 0) {
      try {
        const tablesJson = JSON.stringify(this.tablesArray);
        payload.append('tables', tablesJson);
        console.log('Sending tables JSON:', tablesJson);
      } catch (e) {
        console.error('Error stringifying tables:', e);
        payload.append('tables', '[]');
      }
    } else {
      payload.append('tables', '[]');
    }

    // إضافة المرفقات الجديدة
    this.attachments.forEach((file) => {
      payload.append('Attachments', file, file.name);
    });

    // إضافة المرفقات الحالية
    this.existingAttachments.forEach((attachment) => {
      payload.append('existingAttachments', attachment);
    });

    // إضافة المرفقات المحذوفة
    this.deletedAttachments.forEach((deletedAttachment) => {
      payload.append('deletedAttachments', deletedAttachment);
    });

    // إضافة draftId إذا كان في وضع التعديل
    if (this.isEditing && this.draftId) {
      payload.append('draftId', this.draftId);
      console.log('Added draftId to FormData:', this.draftId);
    }

    return payload;
  }

  private markAllFieldsAsTouched(): void {
    Object.keys(this.form.controls).forEach((key) => {
      this.form.get(key)?.markAsTouched();
    });
  }

  private showValidationErrors(): void {
    const errors: string[] = [];

    if (this.form.get('activityTitle')?.invalid)
      errors.push('• العنوان مطلوب (حتى 150 حرف)');
    if (this.form.get('activityDescription')?.invalid)
      errors.push('• الوصف مطلوب (10 أحرف على الأقل، حتى 1000 حرف)');
    if (this.form.get('MainCriteria')?.invalid)
      errors.push('• المعيار الرئيسي مطلوب');
    if (this.form.get('SubCriteria')?.invalid)
      errors.push('• المعيار الفرعي مطلوب');

    Swal.fire({
      title: 'بيانات ناقصة',
      html: `يرجى ملء جميع الحقول المطلوبة:<br>${errors.join('<br>')}`,
      icon: 'warning',
      confirmButtonText: 'حسناً',
    });
  }

  cancel() {
    Swal.fire({
      title: 'تأكيد الإلغاء',
      text: 'هل تريد إلغاء العملية؟',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'نعم',
      cancelButtonText: 'إلغاء',
      reverseButtons: true
    }).then((result) => {
      if (result.isConfirmed) {
        this.cleanupForm();
      }
    });
  }

  private cleanupForm() {
    localStorage.removeItem('editingDraft');
    localStorage.removeItem('lastPdfFilename');
    this.pdfFilename = null;
    this.router.navigate(['/achievements']);
  }

  resetForm() {
    this.form.reset();
    if (this.descriptionEditor) {
      this.descriptionEditor.nativeElement.innerHTML = '';
    }
    this.attachments = [];
    this.existingAttachments = [];
    this.deletedAttachments = [];
    this.subCriteria = [];
    this.selectedMain = '';
    this.isEditing = false;
    this.draftId = '';
    this.originalDraftData = null;
    this.pdfFilename = null;
    this.pdfGenerating = false;
    this.pdfLoading = false;

    // إعادة تعيين الجداول
    this.tablesArray = [];
    this.tablesFormArray.clear();
    this.showTableModal = false;
    this.editingTableIndex = null;
  }

  ngOnDestroy(): void {
    localStorage.removeItem('lastPdfFilename');
  }

  // ==================== وظائف مساعدة للمرفقات ====================

  getFileName(attachmentUrl: string): string {
    if (!attachmentUrl) return 'ملف';
    const parts = attachmentUrl.split('/');
    return parts[parts.length - 1] || 'ملف';
  }

  getFileType(attachmentUrl: string): string {
    if (!attachmentUrl) return '';
    const ext = attachmentUrl.split('.').pop()?.toLowerCase() || '';
    if (['pdf'].includes(ext)) return 'PDF';
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext))
      return 'صورة';
    return 'ملف';
  }

  isImage(attachmentUrl: string): boolean {
    if (!attachmentUrl) return false;
    const ext = attachmentUrl.split('.').pop()?.toLowerCase() || '';
    return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext);
  }

  isImageFile(file: File): boolean {
    if (!file) return false;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext);
  }

  getFullAttachmentUrl(attachmentPath: string): string {
    if (!attachmentPath) return '';
    if (attachmentPath.startsWith('http')) {
      return attachmentPath;
    }
    if (attachmentPath.startsWith('/uploads/')) {
      return `http://localhost:3000${attachmentPath}`;
    }
    if (attachmentPath.startsWith('uploads/')) {
      return `http://localhost:3000/${attachmentPath}`;
    }
    return `http://localhost:3000/uploads/${attachmentPath}`;
  }

  getFilePreview(file: File): string {
    if (this.isImageFile(file)) {
      return URL.createObjectURL(file);
    }
    return '';
  }

  viewAttachment(attachmentUrl: string): void {
    const fullUrl = this.getFullAttachmentUrl(attachmentUrl);
    window.open(fullUrl, '_blank');
  }

  // ==================== وظائف المرفقات ====================

  onFilesSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    if (!input.files) return;

    const files = Array.from(input.files);
    const totalFiles =
      this.attachments.length + files.length + this.existingAttachments.length;

    if (totalFiles > this.maxFiles) {
      this.showWarning(`الحد الأقصى ${this.maxFiles} ملفات فقط.`);
      return;
    }

    for (const f of files) {
      const sizeMB = f.size / (1024 * 1024);
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      const allowedImage = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'];

      if (!(ext === 'pdf' || allowedImage.includes(ext))) {
        this.showError('نوع ملف غير مدعوم. يُسمح فقط بالصور أو PDF.');
        continue;
      }
      if (sizeMB > this.maxFileSizeMB) {
        this.showError(`حجم الملف أكبر من ${this.maxFileSizeMB}MB.`);
        continue;
      }
      this.attachments.push(f);
    }

    input.value = '';
  }

  removeAttachment(index: number) {
    this.attachments.splice(index, 1);
    this.showSuccess('تم حذف الملف بنجاح.');
  }

  removeExistingAttachment(index: number) {
    const attachmentToRemove = this.existingAttachments[index];

    Swal.fire({
      title: 'تأكيد الحذف',
      text: 'هل تريد حذف هذا المرفق؟',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'نعم',
      cancelButtonText: 'إلغاء',
      reverseButtons: true
    }).then((result) => {
      if (result.isConfirmed) {
        this.deletedAttachments.push(attachmentToRemove);
        this.existingAttachments.splice(index, 1);
        this.showSuccess('تم حذف الملف بنجاح.');
      }
    });
  }

  // ==================== رسائل SweetAlert ====================

  private showSuccess(message: string): Promise<any> {
    return Swal.fire({
      title: 'تم',
      text: message,
      icon: 'success',
      confirmButtonText: 'حسناً',
    });
  }

  private showError(message: string): void {
    Swal.fire({
      title: 'خطأ',
      text: message,
      icon: 'error',
      confirmButtonText: 'حسناً',
    });
  }

  private showWarning(title: string, text?: string): void {
    Swal.fire({
      title,
      text,
      icon: 'warning',
      confirmButtonText: 'حسناً',
    });
  }
}
