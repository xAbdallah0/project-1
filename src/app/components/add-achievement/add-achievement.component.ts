import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  HostListener,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
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
      this.form.patchValue({
        activityTitle: this.originalDraftData.activityTitle,
        activityDescription: this.originalDraftData.activityDescription,
        MainCriteria:
          this.originalDraftData.MainCriteria?._id ||
          this.originalDraftData.MainCriteria,
        SubCriteria:
          this.originalDraftData.SubCriteria?._id ||
          this.originalDraftData.SubCriteria,
        name: this.originalDraftData.name,
      });

      if (
        this.originalDraftData.Attachments &&
        Array.isArray(this.originalDraftData.Attachments)
      ) {
        this.existingAttachments = [...this.originalDraftData.Attachments];
      } else {
        this.existingAttachments = [];
      }

      const mainCriteriaId =
        this.originalDraftData.MainCriteria?._id ||
        this.originalDraftData.MainCriteria;
      if (mainCriteriaId) {
        this.selectedMain = mainCriteriaId;
        this.getSubCriteria(mainCriteriaId);
      }

      if (
        this.descriptionEditor &&
        this.originalDraftData.activityDescription
      ) {
        const plainText = this.stripHTML(
          this.originalDraftData.activityDescription
        );
        this.descriptionEditor.nativeElement.innerText = plainText;
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
      },
      { updateOn: 'change' }
    );
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
    let plainText = this.descriptionEditor.nativeElement.innerText || '';

    plainText = this.cleanText(plainText);

    if (plainText.length < 10) {
      this.form.get('activityDescription')?.setErrors({ minlength: true });
    } else if (plainText.length > 1000) {
      this.form.get('activityDescription')?.setErrors({ maxlength: true });
    } else {
      this.form.get('activityDescription')?.setErrors(null);
    }

    this.form.get('activityDescription')?.setValue(plainText);
    this.form.get('activityDescription')?.markAsTouched();
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

  private stripHTML(html: string): string {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    const text = div.textContent || div.innerText || '';
    return this.cleanText(text);
  }

  getDescriptionLength(): number {
    const description = this.form.get('activityDescription')?.value;
    if (!description) return 0;
    return description.length;
  }

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

    this.showConfirm('تأكيد الحذف', 'هل تريد حذف هذا المرفق؟', 'warning').then(
      (result) => {
        if (result.isConfirmed) {
          this.deletedAttachments.push(attachmentToRemove);
          this.existingAttachments.splice(index, 1);
          this.showSuccess('تم حذف الملف بنجاح.');
        }
      }
    );
  }

  // ==================== وظائف PDF Testing ====================

  // توليد PDF تجريبي - الحل الجديد
generateTestingPdf(): void {
  if (this.form.invalid) {
    // ...
    return;
  }

  this.pdfGenerating = true;

  // مش محتاج activityId دلوقتي
  // const activityId = ...  ← شيله

  // اختياري: لو عايز تبعت فلاتر
  const filters = {
    // user: "specific-user-id",     // اختياري
    // from: "2025-01-01",
    // to:   "2025-12-31",
  };

  this.activityService.generateAllActivitiesPDFtsting(filters).subscribe({
    next: (res) => {
      this.pdfGenerating = false;
      if (res.success && res.file) {
        window.open(res.file, '_blank');
        this.showSuccess('تم إنشاء التقرير بنجاح');
      } else {
        this.showError(res.message || 'حدث خطأ');
      }
    },
    error: (err) => {
      this.pdfGenerating = false;
      this.showError('فشل إنشاء الـ PDF');
      console.error(err);
    }
  });
}
  // استخراج اسم الملف من URL
  private extractFilenameFromUrl(url: string): string {
    if (!url) return 'achievement.pdf';
    try {
      const urlParts = url.split('/');
      return urlParts[urlParts.length - 1];
    } catch (error) {
      console.warn('Error extracting filename:', error);
      return 'achievement.pdf';
    }
  }

  // تجهيز بيانات النشاط لـ PDF
  private prepareActivityDataForPDF(): any {
    // إضافة علامة أنها نسخة تجريبية وبيانات فردية
    return {
      isTesting: true,
      testingMode: true,
      source: 'achievement-form',
      isSingleAchievement: true,
      achievementType: 'individual',

      // البيانات الأساسية
      activityTitle: this.form.get('activityTitle')?.value,
      activityDescription: this.form.get('activityDescription')?.value,
      MainCriteria: this.form.get('MainCriteria')?.value,
      SubCriteria: this.form.get('SubCriteria')?.value,
      name: this.form.get('name')?.value || '',
      Attachments: [...this.existingAttachments],
      newAttachments: this.attachments.map(f => f.name),
      date: new Date().toISOString(),
      createdBy: localStorage.getItem('fullname') || '',
      userId: localStorage.getItem('userId') || ''
    };
  }

  // فتح PDF التجريبي - الحل الجديد
  openPdfTesting(): void {
    if (!this.pdfFilename) {
      this.showWarning('لا يوجد ملف PDF متاح للعرض', 'يرجى إنشاء PDF أولاً');
      return;
    }

    this.pdfLoading = true;

    // استخدم الدالة viewPDF الموجودة في الـ service
    this.activityService.viewPDF(this.pdfFilename).subscribe({
      next: (blob: Blob) => {
        this.pdfLoading = false;
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      },
      error: (err: any) => {
        console.error('Error fetching PDF:', err);
        this.pdfLoading = false;
        this.showWarning('لا يمكن عرض الملف حالياً', 'يرجى المحاولة مرة أخرى');
      }
    });
  }

  // تنزيل PDF - الحل الجديد
  downloadPdf(): void {
    if (!this.pdfFilename) {
      this.showWarning('لا يوجد ملف PDF متاح للتنزيل');
      return;
    }

    const downloadName = this.generateDownloadName();

    // استخدم الدالة downloadPDF الموجودة في الـ service
    this.activityService.downloadPDF(this.pdfFilename, downloadName);
  }

  // حفظ اسم ملف PDF
  private savePdfFilename(filename: string): void {
    this.pdfFilename = filename;
    localStorage.setItem('lastPdfFilename', filename);
  }

  // توليد اسم الملف للتنزيل
  private generateDownloadName(): string {
    const title = this.form.get('activityTitle')?.value
      ? this.form.get('activityTitle')?.value.replace(/[^\w\u0600-\u06FF]/g, '_')
      : 'انجاز';
    const date = new Date().toISOString().split('T')[0];
    return `انجاز_تجريبي_${title}_${date}.pdf`;
  }

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

  private addNewActivity(status: string, saveStatus: string) {
    const payload = this.createFormData(status, saveStatus);

    this.showLoading('جاري الحفظ...', 'يرجى الانتظار قليلاً.');

    this.activityService.addActivity(payload).subscribe({
      next: () => {
        const message =
          saveStatus === 'مسودة'
            ? 'تم حفظ المسودة بنجاح'
            : 'تم إرسال النشاط بنجاح للمراجعة';
        this.showSuccess(message).then(() => {
          this.cleanupForm();
        });
      },
      error: (err) => {
        console.error('خطأ أثناء الحفظ:', err);
        this.showError(err?.error?.message || 'حدث خطأ أثناء الحفظ.');
      },
    });
  }

  private updateDraft(status: string, saveStatus: string) {
    const payload = this.createFormData(status, saveStatus);

    this.showLoading('جاري التحديث...', 'يرجى الانتظار قليلاً.');

    this.activityService.updateDraftActivity(this.draftId, payload).subscribe({
      next: (response) => {
        const message =
          saveStatus === 'مسودة'
            ? 'تم تحديث المسودة بنجاح'
            : 'تم إرسال النشاط بنجاح للمراجعة';
        this.showSuccess(message).then(() => {
          this.cleanupForm();
        });
      },
      error: (err) => {
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
      errors.push('• الوصف مطلوب (10 أحرف على الأقل)');
    if (this.form.get('MainCriteria')?.invalid)
      errors.push('• المعيار الرئيسي مطلوب');
    if (this.form.get('SubCriteria')?.invalid)
      errors.push('• المعيار الفرعي مطلوب');

    this.showWarning(
      'بيانات ناقصة',
      `يرجى ملء جميع الحقول المطلوبة:<br>${errors.join('<br>')}`
    );
  }

  cancel() {
    this.showConfirm(
      'تأكيد الإلغاء',
      'هل تريد إلغاء العملية؟',
      'question'
    ).then((result) => {
      if (result.isConfirmed) {
        this.cleanupForm();
      }
    });
  }

  private cleanupForm() {
    localStorage.removeItem('editingDraft');
    localStorage.removeItem('lastPdfFilename');
    this.pdfFilename = null;
    this.resetForm();
  }

  resetForm() {
    this.form.reset();
    if (this.descriptionEditor) {
      this.descriptionEditor.nativeElement.innerText = '';
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
  }

  ngOnDestroy(): void {
    this.cleanupForm();
  }

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

  private showLoading(title: string, text: string): void {
    Swal.fire({
      title,
      text,
      icon: 'info',
      showConfirmButton: false,
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
  }

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

  private showConfirm(title: string, text: string, icon: any): Promise<any> {
    return Swal.fire({
      title,
      text,
      icon,
      showCancelButton: true,
      confirmButtonText: 'نعم',
      cancelButtonText: 'إلغاء',
    });
  }
}
