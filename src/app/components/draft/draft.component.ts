import { Component, OnInit } from '@angular/core';
import { ActivityService } from 'src/app/service/achievements-service.service';
import { Activity, TableData } from 'src/app/model/achievement';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import Swal from 'sweetalert2';
import { environment } from 'src/app/environments/environments';
import { cleanRichTextHtml, extractDescriptionParts, getTextFromDescription, getTablesFromDescription, DescriptionPart } from 'src/app/shared/quill-editor.config';

@Component({
  selector: 'app-drafts',
  templateUrl: './draft.component.html',
  styleUrls: ['./draft.component.css'],
})
export class DraftsComponent implements OnInit {
  draftActivities: Activity[] = [];
  loading = true;
  selectedImage: string = '';
  showImageModal = false;
  showTableModal = false;
  selectedTable: TableData | null = null;
  isExpanded: { [key: string]: boolean } = {};

  constructor(
    private activityService: ActivityService,
    private router: Router,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.checkAuth();
    this.loadDrafts();
  }

  checkAuth(): void {
    const token =
      localStorage.getItem('token') || localStorage.getItem('authToken');
    if (!token) {
      Swal.fire({
        icon: 'warning',
        title: 'تنبيه',
        text: 'لم يتم العثور على توكن المصادقة. يرجى تسجيل الدخول.',
        confirmButtonText: 'حسناً',
        confirmButtonColor: '#3085d6',
      }).then(() => {
        this.router.navigate(['/login']);
      });
      return;
    }
  }

  // ==== وظائف عرض الوصف ====
  getSafeDescription(description: string | string[]): SafeHtml {
    const text = getTextFromDescription(description);
    if (!text || !text.trim()) {
      return this.sanitizer.bypassSecurityTrustHtml('لا يوجد وصف');
    }
    return this.sanitizer.bypassSecurityTrustHtml(text);
  }

  getPlainTextDescription(description: string | string[]): string {
    const text = getTextFromDescription(description);
    if (!text || !text.trim()) return 'لا يوجد وصف';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = text;
    const plain = tempDiv.textContent || tempDiv.innerText || '';
    return plain.length > 150 ? plain.substring(0, 150) + '...' : plain;
  }

  hasLongDescription(description: string | string[]): boolean {
    if (!description) return false;
    const text = this.getPlainTextDescription(description);
    return text.length > 150;
  }

  toggleDescription(id: string): void {
    this.isExpanded[id] = !this.isExpanded[id];
  }

  getDescriptionParts(description: string | string[]): DescriptionPart[] {
    return extractDescriptionParts(description);
  }

  getTableParts(description: string | string[]): string[] {
    return getTablesFromDescription(description);
  }

  getTableSafeHtml(tableHtml: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(tableHtml);
  }

  // ==== وظائف الجداول ====
  hasTables(activity: Activity): boolean {
    if (!activity) return false;

    const tables = activity.tables;
    if (tables === undefined || tables === null) return false;

    if (typeof tables === 'string') {
      return tables.trim() !== '' && tables.trim() !== '[]';
    }

    if (Array.isArray(tables)) {
      return tables.length > 0;
    }

    return false;
  }

  getTables(activity: Activity): TableData[] {
    if (!activity.tables) return [];

    let tables = activity.tables;

    if (typeof tables === 'string') {
      try {
        const parsed = JSON.parse(tables);
        tables = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.error('Error parsing tables JSON:', e);
        return [];
      }
    }

    if (Array.isArray(tables)) {
      return tables.map((table: any, index: number) => {
        return {
          title: table.title || `جدول ${index + 1}`,
          rows: table.rows || 1,
          cols: table.cols || 2,
          data: Array.isArray(table.data) ? table.data : [],
          html: table.html || ''
        };
      });
    }

    return [];
  }

  getTablesCount(activity: Activity): number {
    return this.getTables(activity).length;
  }

  viewTableFullscreen(table: TableData): void {
    this.selectedTable = table;
    this.showTableModal = true;
  }

  closeTableModal(): void {
    this.showTableModal = false;
    this.selectedTable = null;
  }

  // ==== وظائف المرفقات ====
  hasAttachmentsOrTables(activity: Activity): boolean {
    const hasAttachments = activity.Attachments &&
                          Array.isArray(activity.Attachments) &&
                          activity.Attachments.length > 0;
    const hasTables = this.hasTables(activity);

    return hasAttachments || hasTables;
  }

  // ==== وظائف المساعدة ====
  getCleanDescription(description: string | string[]): string {
    const text = getTextFromDescription(description);
    if (!text || !text.trim()) return 'لا يوجد وصف';

    if (text.includes('<') && text.includes('>')) {
      return this.stripHtmlTags(text);
    }

    return text.length > 200 ? text.substring(0, 200) + '...' : text;
  }

  getRichDescription(description: string | string[]): SafeHtml {
    const text = getTextFromDescription(description);
    const fallback = this.getCleanDescription(text);
    return this.sanitizer.bypassSecurityTrustHtml(
      cleanRichTextHtml(text || fallback)
    );
  }

  private stripHtmlTags(html: string): string {
    if (!html) return '';

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    const tables = tempDiv.querySelectorAll('table');
    tables.forEach(table => table.remove());

    const text = tempDiv.textContent || tempDiv.innerText || '';
    return text.length > 200 ? text.substring(0, 200) + '...' : text;
  }

  getMainCriteriaName(activity: Activity): string {
    return typeof activity.MainCriteria === 'object'
      ? activity.MainCriteria?.name || 'غير محدد'
      : activity.MainCriteria || 'غير محدد';
  }

  getSubCriteriaName(activity: Activity): string {
    return typeof activity.SubCriteria === 'object'
      ? activity.SubCriteria?.name || 'غير محدد'
      : activity.SubCriteria || 'غير محدد';
  }

  getStatusBadgeClass(status: string): string {
    const statusClasses: { [key: string]: string } = {
      'قيد المراجعة': 'bg-warning',
      'معتمد': 'bg-success',
      'مرفوض': 'bg-danger',
      'مسودة': 'bg-secondary',
      'مكتمل': 'bg-info'
    };
    return statusClasses[status] || 'bg-secondary';
  }

  isImage(attachment: string): boolean {
    if (!attachment) return false;

    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const lowerAttachment = attachment.toLowerCase();
    return imageExtensions.some(ext => lowerAttachment.includes(ext));
  }

  isPdf(attachment: string): boolean {
    if (!attachment) return false;
    return attachment.toLowerCase().includes('.pdf');
  }

  getFullAttachmentUrl(attachment: string): string {
    if (!attachment) return '';

    if (attachment.startsWith('http')) {
      return attachment;
    } else if (attachment.startsWith('/')) {
      return environment.baseUrl + attachment;
    } else {
      return environment.baseUrl + '/uploads/' + attachment;
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
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'غير محدد';
    }
  }

  loadDrafts(): void {
    this.loading = true;
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');

    if (!token) {
      Swal.fire({
        icon: 'warning',
        title: 'تنبيه',
        text: 'يرجى تسجيل الدخول أولاً',
        confirmButtonText: 'حسناً',
        confirmButtonColor: '#3085d6',
      }).then(() => {
        this.router.navigate(['/login']);
      });
      return;
    }

    this.activityService.getDrafts().subscribe({
      next: (response) => {
        if (response.success) {
          this.draftActivities = response.data || [];
          console.log('Loaded draft activities:', this.draftActivities);

          this.draftActivities.forEach(activity => {
            if (activity.tables) {
              console.log('Tables found for activity:', activity.activityTitle, activity.tables);
            }
          });

          if (this.draftActivities.length === 0) {
            console.log('لا توجد مسودات');
          }
        } else {
          const errorMessage = (response as any).message || 'Unknown error';
          Swal.fire({
            icon: 'error',
            title: 'خطأ',
            text: 'فشل في تحميل المسودات: ' + errorMessage,
            confirmButtonText: 'حسناً',
            confirmButtonColor: '#d33',
          });
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading drafts:', err);

        if (err.status === 404) {
          this.draftActivities = [];
          console.log('لا توجد مسودات (404)');
          this.loading = false;
          return;
        }

        if (err.status === 401) {
          Swal.fire({
            icon: 'warning',
            title: 'انتهت الجلسة',
            text: 'انتهت جلستك. يرجى تسجيل الدخول مرة أخرى.',
            confirmButtonText: 'تسجيل الدخول',
            confirmButtonColor: '#3085d6',
          }).then(() => {
            localStorage.removeItem('token');
            localStorage.removeItem('authToken');
            this.router.navigate(['/login']);
          });
        } else {
          Swal.fire({
            icon: 'error',
            title: 'خطأ',
            text: 'حدث خطأ في تحميل المسودات: ' + err.message,
            confirmButtonText: 'حسناً',
            confirmButtonColor: '#d33',
          });
        }
        this.loading = false;
      },
    });
  }

  editDraft(activity: Activity): void {
    console.log('Editing draft:', activity.activityTitle);

    const draftToEdit = { ...activity };

    if (draftToEdit.tables && typeof draftToEdit.tables === 'string') {
      try {
        draftToEdit.tables = JSON.parse(draftToEdit.tables);
      } catch (e) {
        console.error('Error parsing tables for edit:', e);
        draftToEdit.tables = [];
      }
    }

    localStorage.setItem('editingDraft', JSON.stringify(draftToEdit));

    this.router.navigate(['/add-achievement'], {
      queryParams: {
        edit: 'true',
        draftId: activity._id,
      },
    });
  }

  deleteDraft(id: string): void {
    Swal.fire({
      title: 'هل أنت متأكد؟',
      text: 'لن تتمكن من استعادة هذه المسودة بعد الحذف!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'نعم، احذفها',
      cancelButtonText: 'إلغاء',
      reverseButtons: true,
    }).then((result) => {
      if (result.isConfirmed) {
        this.activityService.delete(id).subscribe({
          next: (response) => {
            if (response.success) {
              this.loadDrafts();
              Swal.fire({
                title: 'تم الحذف!',
                text: 'تم حذف المسودة بنجاح.',
                icon: 'success',
                confirmButtonColor: '#3085d6',
                confirmButtonText: 'حسناً',
              });
            } else {
              const errorMessage = (response as any).message || 'Unknown error';
              Swal.fire({
                icon: 'error',
                title: 'خطأ',
                text: 'فشل في حذف المسودة: ' + errorMessage,
                confirmButtonText: 'حسناً',
                confirmButtonColor: '#d33',
              });
            }
          },
          error: (err) => {
            console.error('Error deleting draft:', err);
            Swal.fire({
              icon: 'error',
              title: 'خطأ',
              text: 'فشل في حذف المسودة: ' + err.message,
              confirmButtonText: 'حسناً',
              confirmButtonColor: '#d33',
            });
          },
        });
      }
    });
  }
}
