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
  tableRows = 3;
  tableCols = 3;
  currentTableData: any[][] = [];
  editingTableIndex: number | null = null;
  tablesArray: any[] = [];
  private lastFocusedCell: { row: number, col: number } | null = null;

  // متغيرات PDF Testing
  pdfGenerating = false;
  pdfLoading = false;
  pdfFilename: string | null = null;

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
    const savedDraft = localStorage.getItem('editingDraft');

    if (savedDraft) {
      try {
        this.originalDraftData = JSON.parse(savedDraft);
        this.populateFormWithDraftData();
      } catch (error) {
        console.error('Error parsing draft data:', error);
        this.showError('حدث خطأ في تحميل بيانات المسودة');
      }
    } else {
      this.showWarning('لم يتم العثور على بيانات المسودة');
    }
  }

  populateFormWithDraftData(): void {
    if (this.originalDraftData && this.form) {
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
      } else {
        this.existingAttachments = [];
      }

      // تحميل الجداول الحالية
      if (this.originalDraftData.tables && Array.isArray(this.originalDraftData.tables)) {
        this.tablesArray = [...this.originalDraftData.tables];

        // إضافة الجداول إلى FormArray
        this.tablesFormArray.clear();
        this.originalDraftData.tables.forEach((table: any) => {
          this.tablesFormArray.push(this.fb.control(table));
        });
      }

      // تحميل النص في المحرر (النص فقط بدون جداول)
      if (this.descriptionEditor) {
        this.descriptionEditor.nativeElement.innerHTML =
          this.extractPlainText(this.originalDraftData.activityDescription) ||
          '';
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
        tables: this.fb.array([]) // FormArray للجداول
      },
      { updateOn: 'change' }
    );
  }

  // الحصول على FormArray للجداول
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

  exec(command: string, value?: string) {
    this.descriptionEditor.nativeElement.focus();
    document.execCommand(command, false, value);
    this.syncDescriptionToForm();
  }

  syncDescriptionToForm() {
    let htmlContent = this.descriptionEditor.nativeElement.innerHTML || '';

    // استخراج النص فقط (بدون أي HTML)
    const plainText = this.extractPlainText(htmlContent);

    // حفظ النص فقط في activityDescription
    this.form.get('activityDescription')?.setValue(plainText);

    // التحقق من الطول للنص فقط
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

    // إنشاء عنصر مؤقت
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // استخراج النص فقط من جميع العناصر
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

  // ==================== وظائف الجداول المحسنة ====================

  openTableModal(tableIndex?: number): void {
    this.showTableModal = true;
    this.editingTableIndex = tableIndex !== undefined ? tableIndex : null;

    if (tableIndex !== undefined && tableIndex !== null) {
      const existingTable = this.getExistingTable(tableIndex);
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

  onTableSizeChange(): void {
    // تأكد من أن القيم ضمن النطاق المسموح
    this.tableRows = Math.max(1, Math.min(50, this.tableRows || 3));
    this.tableCols = Math.max(1, Math.min(20, this.tableCols || 3));

    // تحديث الجدول بنفس البيانات الحالية
    this.updateTableSize(this.tableRows, this.tableCols);
  }

  updateTableSize(newRows: number, newCols: number): void {
    // إنشاء جدول جديد بالأبعاد الجديدة
    const newTable: any[][] = [];

    for (let i = 0; i < newRows; i++) {
      newTable[i] = [];
      for (let j = 0; j < newCols; j++) {
        // الحفاظ على البيانات القديمة إن وجدت
        if (this.currentTableData[i] && this.currentTableData[i][j] !== undefined) {
          newTable[i][j] = this.currentTableData[i][j];
        } else {
          newTable[i][j] = '';
        }
      }
    }

    this.currentTableData = newTable;

    // تحديث التركيز بعد التغيير
    setTimeout(() => {
      this.restoreFocus();
    }, 100);
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
      for (let j = 0; j < cols; j++) {
        table[i][j] = '';
      }
    }
    return table;
  }

  changeTableSize(): void {
    this.onTableSizeChange();
  }

  saveTable(): void {
    if (!this.currentTableData || this.currentTableData.length === 0) {
      Swal.fire({
        icon: 'error',
        title: 'خطأ',
        text: 'الجدول فارغ!',
        timer: 1500
      });
      return;
    }

    // التحقق من أن الأبعاد صحيحة
    if (this.tableRows < 1 || this.tableRows > 50 || this.tableCols < 1 || this.tableCols > 20) {
      this.showError('عدد الصفوف يجب أن يكون بين 1 و 50، وعدد الأعمدة بين 1 و 20');
      return;
    }

    // التحقق من عدد الجداول
    if (this.tablesArray.length >= 5 && this.editingTableIndex === null) {
      this.showError('الحد الأقصى 5 جداول فقط');
      return;
    }

    // تنظيف البيانات الفارغة النهائية
    const cleanedData = this.cleanTableData(this.currentTableData);

    const tableData = {
      rows: this.tableRows,
      cols: this.tableCols,
      data: cleanedData,
      index: this.editingTableIndex !== null ? this.editingTableIndex : this.tablesArray.length
    };

    if (this.editingTableIndex !== null && this.editingTableIndex >= 0) {
      // تحديث جدول موجود
      this.tablesArray[this.editingTableIndex] = tableData;
      this.tablesFormArray.at(this.editingTableIndex).setValue(tableData);
    } else {
      // إضافة جدول جديد
      this.tablesArray.push(tableData);
      this.tablesFormArray.push(this.fb.control(tableData));
    }

    this.closeTableModal();

    Swal.fire({
      icon: 'success',
      title: this.editingTableIndex !== null ? 'تم تحديث الجدول بنجاح' : 'تم إضافة الجدول بنجاح',
      timer: 1500,
      showConfirmButton: false
    });
  }

  private cleanTableData(data: any[][]): any[][] {
    // إزالة الصفوف الفارغة تماماً
    const cleanedData = data.filter(row =>
      Array.isArray(row) && row.some(cell => cell && cell.toString().trim() !== '')
    );

    // إذا لم تبقى أي صفوف، إرجاع جدول فارغ بأبعاد صحيحة
    if (cleanedData.length === 0) {
      return this.createEmptyTable(this.tableRows, this.tableCols);
    }

    return cleanedData;
  }

  generateTableHTML(data: any[][]): string {
    if (!data || data.length === 0 || !Array.isArray(data)) {
      return '<p class="text-muted">جدول فارغ</p>';
    }

    let html = `
      <div class="table-responsive mt-3">
        <table class="table table-bordered table-hover achievement-table"
              style="width: 100%; border-collapse: collapse; margin: 10px 0; direction: rtl;">
          <tbody>`;

    data.forEach((row, rowIndex) => {
      if (!Array.isArray(row)) return;

      html += '<tr>';
      row.forEach((cell, colIndex) => {
        const cellContent = cell || '&nbsp;';
        html += `
          <td style="border: 1px solid #dee2e6; padding: 8px;
                    text-align: right; vertical-align: middle;">
            ${cellContent}
          </td>`;
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
        // حذف من المصفوفة
        this.tablesArray.splice(index, 1);

        // حذف من FormArray
        if (index < this.tablesFormArray.length) {
          this.tablesFormArray.removeAt(index);
        }

        Swal.fire({
          icon: 'success',
          title: 'تم حذف الجدول بنجاح',
          timer: 1500,
          showConfirmButton: false
        });
      }
    });
  }

  getColumnHeaders(): number[] {
    return Array.from({ length: this.tableCols }, (_, i) => i);
  }

  getEmptyCells(row: any[]): number[] {
    const emptyCellsCount = Math.max(0, this.tableCols - row.length);
    return Array.from({ length: emptyCellsCount }, (_, i) => i);
  }

  getEmptyRows(): number[] {
    const emptyRowsCount = Math.max(0, this.tableRows - this.currentTableData.length);
    return Array.from({ length: emptyRowsCount }, (_, i) => i);
  }

  getEmptyColumns(): number[] {
    return Array.from({ length: this.tableCols }, (_, i) => i);
  }

  clearAllCells(): void {
    Swal.fire({
      title: 'تأكيد المسح',
      text: 'هل تريد مسح جميع محتويات الجدول؟',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'نعم، امسح الكل',
      cancelButtonText: 'إلغاء',
      reverseButtons: true
    }).then((result) => {
      if (result.isConfirmed) {
        for (let i = 0; i < this.currentTableData.length; i++) {
          for (let j = 0; j < this.currentTableData[i].length; j++) {
            this.currentTableData[i][j] = '';
          }
        }

        // تحديث جميع خلايا الإدخال
        setTimeout(() => {
          const inputs = document.querySelectorAll('.editable-cell');
          inputs.forEach((input: any) => {
            if (input) input.value = '';
          });
        }, 50);

        this.showSuccess('تم مسح جميع خلايا الجدول');
      }
    });
  }

  fillWithSampleData(): void {
    const sampleData = [
      ['المهمة', 'المسؤول', 'الموعد', 'الحالة'],
      ['تحضير التقرير', 'أحمد', '2024-01-15', 'مكتمل'],
      ['مراجعة البيانات', 'محمد', '2024-01-20', 'قيد التنفيذ'],
      ['تحليل النتائج', 'سارة', '2024-01-25', 'معلق']
    ];

    // حساب الصفوف والأعمدة المطلوبة
    const sampleRows = Math.min(sampleData.length, this.tableRows);
    const sampleCols = Math.min(sampleData[0]?.length || 4, this.tableCols);

    // تعبئة البيانات
    for (let i = 0; i < sampleRows; i++) {
      for (let j = 0; j < sampleCols; j++) {
        if (!this.currentTableData[i]) this.currentTableData[i] = [];
        this.currentTableData[i][j] = sampleData[i][j] || '';
      }
    }

    // تحديث جميع خلايا الإدخال
    setTimeout(() => {
      for (let i = 0; i < sampleRows; i++) {
        for (let j = 0; j < sampleCols; j++) {
          const input = document.getElementById(`cell-${i}-${j}`) as HTMLInputElement;
          if (input) {
            input.value = sampleData[i][j] || '';
          }
        }
      }
    }, 50);

    this.showSuccess('تم تعبئة الجدول ببيانات تجريبية');
  }

  updateCellValue(rowIndex: number, colIndex: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;

    // التأكد من وجود الصف
    if (!this.currentTableData[rowIndex]) {
      this.currentTableData[rowIndex] = [];
    }

    // تحديث قيمة الخلية
    this.currentTableData[rowIndex][colIndex] = value;
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

    const activityData = {
      activityTitle: this.form.get('activityTitle')?.value,
      activityDescription: this.form.get('activityDescription')?.value,
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
      tables: this.tablesArray // إضافة الجداول إلى PDF
    };

    console.log('📤 إرسال بيانات لإنشاء PDF تجريبي:', activityData);

    this.activityService.generateTestingPDF(activityData).subscribe({
      next: (res) => {
        this.pdfGenerating = false;
        if (res.success && res.fileName) {
          console.log('✅ استجابة PDF:', res);

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
          console.error('❌ خطأ في الاستجابة:', res);
          this.showError(res.message || 'حدث خطأ في إنشاء PDF');
        }
      },
      error: (err) => {
        this.pdfGenerating = false;
        console.error('❌ خطأ في إنشاء PDF:', err);
        this.showError('فشل إنشاء الـ PDF التجريبي: ' + err.message);
      }
    });
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

    console.log('📂 محاولة فتح الملف:', fullFilename);

    this.activityService.viewPDF(fullFilename).subscribe({
      next: (blob: Blob) => {
        this.pdfLoading = false;
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      },
      error: (err: any) => {
        console.error('Error fetching PDF:', err);
        this.pdfLoading = false;

        const fileUrl = `http://localhost:3000/generated-files/${fullFilename}`;
        console.log('🔗 محاولة فتح الرابط:', fileUrl);
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

    // التحقق من الجداول
    if (!this.validateTables()) {
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

  private validateTables(): boolean {
    // التحقق من عدد الجداول
    if (this.tablesArray.length > 5) {
      this.showError('الحد الأقصى 5 جداول فقط');
      return false;
    }

    // التحقق من أن الجداول غير فارغة
    for (let i = 0; i < this.tablesArray.length; i++) {
      const table = this.tablesArray[i];
      if (!table.data || table.data.length === 0 || !Array.isArray(table.data)) {
        this.showError(`الجدول رقم ${i + 1} فارغ أو غير صالح`);
        return false;
      }

      // التحقق من أن كل صف يحتوي على أعمدة
      for (let j = 0; j < table.data.length; j++) {
        if (!Array.isArray(table.data[j])) {
          this.showError(`الصف ${j + 1} في الجدول ${i + 1} غير صالح`);
          return false;
        }
      }
    }

    return true;
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
      next: () => {
        Swal.close();
        const message =
          saveStatus === 'مسودة'
            ? 'تم حفظ المسودة بنجاح'
            : 'تم إرسال النشاط بنجاح للمراجعة';
        this.showSuccess(message).then(() => {
          this.cleanupForm();
        });
      },
      error: (err) => {
        Swal.close();
        console.error('خطأ أثناء الحفظ:', err);
        this.showError(err?.error?.message || 'حدث خطأ أثناء الحفظ.');
      },
    });
  }

  private updateDraft(status: string, saveStatus: string) {
    const payload = this.createFormData(status, saveStatus);

    Swal.fire({
      title: 'جاري التحديث...',
      text: 'يرجى الانتظار قليلاً.',
      icon: 'info',
      showConfirmButton: false,
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    this.activityService.updateDraftActivity(this.draftId, payload).subscribe({
      next: (response) => {
        Swal.close();
        const message =
          saveStatus === 'مسودة'
            ? 'تم تحديث المسودة بنجاح'
            : 'تم إرسال النشاط بنجاح للمراجعة';
        this.showSuccess(message).then(() => {
          this.cleanupForm();
        });
      },
      error: (err) => {
        Swal.close();
        console.error('خطأ أثناء التحديث:', err);
        this.showError(err?.error?.message || 'حدث خطأ أثناء التحديث.');
      },
    });
  }

  private createFormData(status: string, saveStatus: string): FormData {
    const payload = new FormData();

    payload.append('activityTitle', this.form.value.activityTitle);
    payload.append('activityDescription', this.form.value.activityDescription);
    payload.append('MainCriteria', this.form.value.MainCriteria);
    payload.append('SubCriteria', this.form.value.SubCriteria);
    payload.append('status', status);
    payload.append('SaveStatus', saveStatus);
    payload.append('user', localStorage.getItem('userId') || '');
    payload.append(
      'name',
      this.form.value.name || localStorage.getItem('fullname') || ''
    );

    // إضافة الجداول
    if (this.tablesArray.length > 0) {
      payload.append('tables', JSON.stringify(this.tablesArray));
    }

    // إضافة المرفقات
    this.attachments.forEach((file) => {
      payload.append('Attachments', file, file.name);
    });

    this.existingAttachments.forEach((attachment) => {
      payload.append('existingAttachments', attachment);
    });

    this.deletedAttachments.forEach((deletedAttachment) => {
      payload.append('deletedAttachments', deletedAttachment);
    });

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
