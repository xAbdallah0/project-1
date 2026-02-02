import { Component, OnInit } from '@angular/core';
import { ActivityService } from '../../service/achievements-service.service';
import { Activity } from 'src/app/model/achievement';
import Swal from 'sweetalert2';
import { Router } from '@angular/router';

// تعريف نوع للمعايير
interface Criteria {
  _id?: string;
  name?: string;
}

// تعريف نوع للمستخدم
interface User {
  _id?: string;
  name?: string;
  fullname?: string;
  email?: string;
}

@Component({
  selector: 'app-my-achievements',
  templateUrl: './my-achievements.component.html',
  styleUrls: ['./my-achievements.component.css'],
})
export class MyAchievementsComponent implements OnInit {
  searchTerm = '';
  statusFilter = 'all';
  achievements: Activity[] = [];
  selectedAchievement: Activity | null = null;
  rejectionReason = '';
  loading = true;
  // PDF Variables
  pdfFilename: string | null = null;
  pdfGenerating = false;
  pdfLoading = false;
  showDetailsModal = false;
  showRejectModal = false;
  showImageModal = false;
  selectedImage = '';
  isAdmin = false;
  currentUser: any = null;

  constructor(
    private activityService: ActivityService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadActivities();
    this.checkAdminRole();
  }

  checkAdminRole(): void {
    try {
      const token =
        localStorage.getItem('token') || localStorage.getItem('authToken');

      if (token) {
        const tokenPayload = this.decodeToken(token);
        if (tokenPayload) {
          this.currentUser = tokenPayload;
          this.isAdmin =
            tokenPayload.role === 'admin' || tokenPayload.isAdmin === true;
          return;
        }
      }

      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        this.currentUser = user;
        this.isAdmin = user.role === 'admin' || user.isAdmin === true;
        return;
      }

      this.isAdmin = false;
      console.warn('لم يتم العثور على بيانات المستخدم أو token');
    } catch (error) {
      console.error('خطأ في التحقق من صلاحية المستخدم:', error);
      this.isAdmin = false;
    }
  }

  private decodeToken(token: string): any {
    try {
      if (token.split('.').length === 3) {
        const payload = token.split('.')[1];
        const decodedPayload = atob(
          payload.replace(/-/g, '+').replace(/_/g, '/')
        );
        return JSON.parse(decodedPayload);
      }
      return null;
    } catch (error) {
      console.error('خطأ في فك تشفير الـ token:', error);
      return null;
    }
  }

  loadActivities(): void {
    this.loading = true;
    this.activityService.getAll().subscribe({
      next: (res) => {
        if (res.success) {
          this.achievements = res.activities || [];
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading activities:', err);
        this.loading = false;
        Swal.fire('خطأ', 'حدث خطأ أثناء تحميل الإنجازات', 'error');
      },
    });
  }

  getCleanDescription(description: string): string {
    if (!description) return 'لا يوجد وصف';

    if (description.includes('<') && description.includes('>')) {
      return this.stripHtmlTags(description);
    }

    return description;
  }

  private stripHtmlTags(html: string): string {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || '';
  }

  getShortDescription(description: string, length: number = 50): string {
    if (!description) return 'لا يوجد وصف';

    const plainText = this.getCleanDescriptionText(description);
    return plainText.length > length
      ? plainText.substring(0, length) + '...'
      : plainText;
  }

  filteredAchievements(): Activity[] {
    let list = [...this.achievements];
    const term = this.searchTerm.trim().toLowerCase();

    if (term) {
      list = list.filter(
        (a) =>
          a.activityTitle?.toLowerCase().includes(term) ||
          this.getCleanDescriptionText(a.activityDescription || '')
            .toLowerCase()
            .includes(term) ||
          a.name?.toLowerCase().includes(term) ||
          this.getFullName(a.user)?.toLowerCase().includes(term) ||
          this.getUserName(a.user)?.toLowerCase().includes(term)
      );
    }

    if (this.statusFilter !== 'all') {
      list = list.filter((a) => a.status === this.statusFilter);
    }

    return list;
  }

  private getCleanDescriptionText(description: string): string {
    if (!description) return '';
    return this.getCleanDescription(description);
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.statusFilter = 'all';
  }

  openDetailsModal(activity: Activity): void {
    this.selectedAchievement = activity;
    this.showDetailsModal = true;
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedAchievement = null;
  }

  handleAction(action: string, id?: string): void {
    if (!id) return;

    const actions = {
      approve: () => this.updateActivityStatus(id, 'معتمد'),
      reassign: () => this.updateActivityStatus(id, 'قيد المراجعة'),
      delete: () => this.deleteActivity(id),
    };

    const actionHandler = actions[action as keyof typeof actions];
    if (actionHandler) {
      actionHandler();
    }
  }

  getFullName(user: any): string {
    if (!user) return 'غير محدد';

    if (typeof user === 'string') return user;

    return user.fullname || user.name || 'غير محدد';
  }

  updateActivityStatus(
    id: string,
    status: 'معتمد' | 'قيد المراجعة' | 'مرفوض',
    reason?: string
  ): void {
    if (!this.isAdmin) {
      Swal.fire('خطأ', 'ليس لديك صلاحية لهذا الإجراء', 'error');
      return;
    }

    const updateData: any = { status };

    if (status === 'مرفوض') {
      updateData.reasonForRejection = reason || 'لم يتم تحديد سبب الرفض';
    }

    this.activityService.updateStatus(id, updateData).subscribe({
      next: (res) => {
        if (res.success) {
          this.updateLocalStatus(id, status, reason);

          let message = `تم تحديث الحالة إلى ${status}`;
          if (status === 'مرفوض' && reason) {
            message += ` مع سبب الرفض`;
          } else if (status === 'مرفوض') {
            message += ` بدون تحديد سبب`;
          }

          Swal.fire('تم', message, 'success');

          if (status === 'مرفوض') {
            this.closeRejectModal();
            this.closeDetailsModal();
          }
        }
      },
      error: (err) => {
        console.error('Error updating status:', err);
        Swal.fire('خطأ', 'تعذر تحديث الحالة', 'error');
      },
    });
  }

  openRejectModal(activity: Activity): void {
    if (!this.isAdmin) {
      Swal.fire('خطأ', 'ليس لديك صلاحية لهذا الإجراء', 'error');
      return;
    }

    this.selectedAchievement = activity;
    this.rejectionReason = '';
    this.showRejectModal = true;
  }

  closeRejectModal(): void {
    this.showRejectModal = false;
    this.selectedAchievement = null;
  }

  submitRejection(): void {
    if (!this.isAdmin) {
      Swal.fire('خطأ', 'ليس لديك صلاحية لهذا الإجراء', 'error');
      return;
    }

    const achievement = this.selectedAchievement;
    if (!achievement || !achievement._id) return;

    if (
      this.rejectionReason &&
      this.rejectionReason.trim().length > 0 &&
      this.rejectionReason.trim().length < 5
    ) {
      Swal.fire(
        'تحذير',
        'إذا قمت بكتابة سبب الرفض، فيجب أن يكون على الأقل 5 أحرف',
        'warning'
      );
      return;
    }

    const reason = this.rejectionReason
      ? this.rejectionReason.trim()
      : undefined;
    this.updateActivityStatus(achievement._id, 'مرفوض', reason);
  }

  deleteActivity(id: string): void {
    if (!this.isAdmin) {
      Swal.fire('خطأ', 'ليس لديك صلاحية لهذا الإجراء', 'error');
      return;
    }

    Swal.fire({
      title: 'هل أنت متأكد؟',
      text: 'سيتم حذف هذا الإنجاز نهائيًا',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'نعم، حذف',
      cancelButtonText: 'إلغاء',
      confirmButtonColor: '#dc3545',
    }).then((result) => {
      if (result.isConfirmed) {
        this.activityService.delete(id).subscribe({
          next: (res) => {
            if (res.success) {
              this.achievements = this.achievements.filter((a) => a._id !== id);
              Swal.fire('تم الحذف', 'تم حذف الإنجاز بنجاح', 'success');
            }
          },
          error: (err) => {
            console.error('Error deleting activity:', err);
            Swal.fire('خطأ', 'تعذر حذف الإنجاز', 'error');
          },
        });
      }
    });
  }

  private updateLocalStatus(id: string, status: string, reason?: string): void {
    this.achievements = this.achievements.map((a) =>
      a._id === id
        ? {
            ...a,
            status,
            ...(status === 'مرفوض' && {
              reasonForRejection: reason || 'لم يتم تحديد سبب الرفض',
            }),
          }
        : a
    );

    if (this.selectedAchievement && this.selectedAchievement._id === id) {
      this.selectedAchievement.status = status;
      if (status === 'مرفوض') {
        this.selectedAchievement.reasonForRejection =
          reason || 'لم يتم تحديد سبب الرفض';
      }
    }
  }

  getNameField(field: any): string {
    if (!field) return 'غير محدد';

    if (typeof field === 'object') {
      return (field as Criteria).name || 'غير محدد';
    }

    return field;
  }

  getName(field: any): string {
    if (!field) return '';
    const name = typeof field === 'object' ? field.name : field;
    return name?.trim() || '';
  }

  getUserName(user: any): string {
    if (!user) return 'غير محدد';

    if (typeof user === 'string') return user;

    return (user as User).name || 'غير محدد';
  }

  isImage(attachment: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    return imageExtensions.some(
      (ext) =>
        attachment.toLowerCase().endsWith(ext) ||
        attachment.toLowerCase().includes(ext)
    );
  }

  isPdf(attachment: string): boolean {
    return attachment.toLowerCase().includes('.pdf');
  }

  getFullAttachmentUrl(attachment: string): string {
    if (attachment.startsWith('http')) {
      return attachment;
    } else {
      return `http://localhost:3000${attachment}`;
    }
  }

  openImageModal(attachment: string): void {
    this.selectedImage = this.getFullAttachmentUrl(attachment);
    this.showImageModal = true;
  }

  closeImageModal(): void {
    this.showImageModal = false;
    this.selectedImage = '';
  }

  formatDate(dateString: string | Date | undefined | null): string {
    if (!dateString) return 'غير محدد';

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'غير محدد';
      }

      return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'غير محدد';
    }
  }

  getStatusClass(status: string): string {
    const statusClasses: { [key: string]: string } = {
      معتمد: 'bg-success',
      'قيد المراجعة': 'bg-warning',
      مرفوض: 'bg-danger',
      مسودة: 'bg-secondary',
    };
    return statusClasses[status] || 'bg-secondary';
  }

  getStatusHeaderClass(status: string): string {
    const headerClasses: { [key: string]: string } = {
      معتمد: 'bg-gradient-success',
      'قيد المراجعة': 'bg-gradient-warning',
      مرفوض: 'bg-gradient-danger',
      مسودة: 'bg-gradient-secondary',
    };
    return headerClasses[status] || 'bg-gradient-primary';
  }

  // ==================== تعديل دالة التعديل ====================

  // دالة التعديل - الانتقال إلى صفحة الإضافة مع البيانات
  editAchievement(achievement: Activity): void {
  if (!this.isAdmin) {
    Swal.fire('خطأ', 'ليس لديك صلاحية لهذا الإجراء', 'error');
    return;
  }

  // إظهار رسالة تحميل سريعة
  Swal.fire({
    title: 'جارٍ التوجيه...',
    text: 'سيتم تحميل بيانات الإنجاز للتعديل',
    icon: 'info',
    timer: 800,
    showConfirmButton: false
  }).then(() => {
    // الانتقال بعد إغلاق الرسالة
    this.prepareAndNavigateToEdit(achievement);
  });
}

  // دالة تحضير البيانات والانتقال
  private prepareAndNavigateToEdit(achievement: Activity): void {
    console.log('تحضير بيانات التعديل:', achievement);

    // إغلاق المودال الحالي
    this.closeDetailsModal();

    // تحضير البيانات للتعديل
    const editingData = {
      _id: achievement._id,
      activityTitle: achievement.activityTitle || '',
      activityDescription: achievement.activityDescription || '',
      MainCriteria: this.extractCriteriaId(achievement.MainCriteria),
      SubCriteria: this.extractCriteriaId(achievement.SubCriteria),
      name: achievement.name || '',
      status: achievement.status || 'مسودة',
      SaveStatus: achievement.SaveStatus || 'مسودة',
      Attachments: achievement.Attachments || [],
      user: this.extractUserId(achievement.user),
      createdAt: achievement.createdAt,
      updatedAt: achievement.updatedAt,
      reasonForRejection: achievement.reasonForRejection || '',
      // إضافة الجداول إذا كانت موجودة
      tables: achievement.tables || []
    };

    console.log('بيانات التعديل المحضرة:', editingData);

    // حفظ البيانات في localStorage للوصول إليها في صفحة الإضافة
    localStorage.setItem('editingDraft', JSON.stringify(editingData));

    // الانتقال إلى صفحة الإضافة مع معلمات التعديل
    this.router.navigate(['/add-achievement'], {
      queryParams: {
        edit: 'true',
        draftId: achievement._id
      }
    });
  }

  // دالة مساعدة لاستخراج ID من المعيار
  private extractCriteriaId(criteria: any): string | undefined {
    if (!criteria) return undefined;

    if (typeof criteria === 'string') {
      return criteria;
    }

    if (typeof criteria === 'object' && criteria._id) {
      return criteria._id;
    }

    return undefined;
  }

  // دالة مساعدة لاستخراج ID من المستخدم
  private extractUserId(user: any): string | undefined {
    if (!user) return undefined;

    if (typeof user === 'string') {
      return user;
    }

    if (typeof user === 'object' && user._id) {
      return user._id;
    }

    return undefined;
  }

  // دالة الحذف
  deleteAchievement(id: string): void {
    if (!this.isAdmin) {
      Swal.fire('خطأ', 'ليس لديك صلاحية لهذا الإجراء', 'error');
      return;
    }

    Swal.fire({
      title: 'هل أنت متأكد؟',
      text: 'سيتم حذف هذا الإنجاز نهائيًا ولن يمكن استرجاعه',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'نعم، احذف',
      cancelButtonText: 'إلغاء',
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      reverseButtons: true
    }).then((result) => {
      if (result.isConfirmed) {
        this.activityService.delete(id).subscribe({
          next: (res) => {
            if (res.success) {
              // إزالة الإنجاز من القائمة
              this.achievements = this.achievements.filter(a => a._id !== id);

              // إغلاق المودال إذا كان مفتوحًا لهذا الإنجاز
              if (this.selectedAchievement && this.selectedAchievement._id === id) {
                this.closeDetailsModal();
              }

              Swal.fire('تم الحذف', 'تم حذف الإنجاز بنجاح', 'success');
            }
          },
          error: (err) => {
            console.error('Error deleting achievement:', err);
            Swal.fire('خطأ', 'تعذر حذف الإنجاز', 'error');
          }
        });
      }
    });
  }

  // دالة حذف من المودال (لإعادة استخدامها)
  deleteFromModal(): void {
    if (!this.selectedAchievement || !this.selectedAchievement._id) return;
    this.deleteAchievement(this.selectedAchievement._id);
  }


  // ==================== PDF Methods ====================

  generatePdf(): void {
    if (!this.selectedAchievement) {
      Swal.fire('خطأ', 'لا يوجد إنجاز محدد لإنشاء PDF', 'error');
      return;
    }

    this.pdfGenerating = true;

    const activityData = {
      activityTitle: this.selectedAchievement.activityTitle || '',
      activityDescription: this.selectedAchievement.activityDescription || '',
      mainCriteriaName: this.getNameField(this.selectedAchievement.MainCriteria),
      subCriteriaName: this.getNameField(this.selectedAchievement.SubCriteria),
      userName: this.getFullName(this.selectedAchievement.user),
      name: this.getName(this.selectedAchievement.user),
      date: this.selectedAchievement.date || new Date().toISOString(),
      Attachments: this.selectedAchievement.Attachments || [],
      tables: this.selectedAchievement.tables || []
    };

    this.activityService.generateTestingPDF(activityData).subscribe({
      next: (res) => {
        this.pdfGenerating = false;
        if (res.success && res.fileName) {
          this.pdfFilename = this.processFilename(res.fileName, res.filePath);
          Swal.fire('تم', 'تم إنشاء PDF بنجاح', 'success');
        } else {
          Swal.fire('خطأ', res.message || 'حدث خطأ في إنشاء PDF', 'error');
        }
      },
      error: (err) => {
        this.pdfGenerating = false;
        Swal.fire('خطأ', 'فشل إنشاء الـ PDF: ' + err.message, 'error');
      }
    });
  }

  openPdf(): void {
    if (!this.pdfFilename) {
      Swal.fire('تحذير', 'لا يوجد ملف PDF متاح للعرض. يرجى إنشاء PDF أولاً', 'warning');
      return;
    }

    this.pdfLoading = true;
    const fullFilename = this.getFullFilename(this.pdfFilename);

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
        Swal.fire({
          title: 'تنبيه',
          text: 'تم فتح الملف في نافذة جديدة. إذا لم يعمل، يرجى التحقق من المسار',
          icon: 'info',
          timer: 3000
        });
      }
    });
  }

  downloadPdf(): void {
    if (!this.pdfFilename) {
      Swal.fire('تحذير', 'لا يوجد ملف PDF متاح للتنزيل', 'warning');
      return;
    }

    const downloadName = this.generateDownloadName();
    const fullFilename = this.getFullFilename(this.pdfFilename);

    this.activityService.downloadPDF(fullFilename, downloadName);
  }

  private processFilename(fileName: string, filePath?: string): string {
    let filename = fileName;
    if (filePath) {
      const pathParts = filePath.split('/');
      filename = pathParts[pathParts.length - 1];
      if (filePath.includes('/testing/')) {
        filename = `testing/${filename}`;
      }
    }
    return filename;
  }

  private getFullFilename(filename: string): string {
    if (!filename.startsWith('testing/') && filename.startsWith('تقرير_انجاز_تجريبي')) {
      return `testing/${filename}`;
    }
    return filename;
  }

  private generateDownloadName(): string {
    const title = this.selectedAchievement?.activityTitle
      ? this.selectedAchievement.activityTitle.replace(/[^\w\u0600-\u06FF]/g, '_')
      : 'انجاز';
    const date = new Date().toISOString().split('T')[0];
    return `انجاز_${title}_${date}.pdf`;
  }
}
