import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  ActivityService,
  PDFFile,
  ReportFilters,
  ReportGenerationResponse,
} from '../../service/achievements-service.service';
import {
  CriteriaService,
  MainCriteria,
  SubCriteria,
} from '../../service/criteria.service';
import { AdministrationService } from '../../service/user.service';
import Swal from 'sweetalert2';

interface ReportFilter {
  startDate: string;
  endDate: string;
  MainCriteria?: string[];
  SubCriteria?: string[];
  users?: string[];
  status?: string[];
}

interface DropdownOption {
  value: string;
  label: string;
  selected: boolean;
}

type DropdownType = 'users' | 'mainCriteria' | 'subCriteria' | 'status';

@Component({
  selector: 'app-reports',
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.css'],
})
export class ReportsComponent implements OnInit, OnDestroy {
  showFilters: boolean = false;
  isLoading = false;
  isLoadingPDFs = false;
  showDateError = false;
  dateRequiredError = false;
  showReportResults = false;
  showPreviousReports = true;
  maxDate: string;
  currentDate: string;
  reportType: 'pdf' | 'docx' = 'pdf';
  fileTypeFilter: string = 'all';
  filters: ReportFilter = {
    startDate: '',
    endDate: '',
    MainCriteria: [],
    SubCriteria: [],
    users: [],
    status: [],
  };

  pdfFiles: PDFFile[] = [];
  filteredPDFs: PDFFile[] = [];
  generatedReport: any = null;
  mainCriteriaList: MainCriteria[] = [];
  allSubCriteria: SubCriteria[] = [];
  userOptions: DropdownOption[] = [];
  mainCriteriaOptions: DropdownOption[] = [];
  subCriteriaOptions: DropdownOption[] = [];
  statusOptions: DropdownOption[] = [
    { value: 'معتمد', label: 'معتمد', selected: false },
    { value: 'مرفوض', label: 'مرفوض', selected: false },
    { value: 'قيد المراجعة', label: 'قيد المراجعة', selected: false },
  ];

  searchTerm: string = '';
  searchTimeout: any;

  dropdownStates: Record<DropdownType, boolean> = {
    users: false,
    mainCriteria: false,
    subCriteria: false,
    status: false,
  };

  searchTerms: Record<DropdownType, string> = {
    users: '',
    mainCriteria: '',
    subCriteria: '',
    status: '',
  };

  filteredUserOptions: DropdownOption[] = [];
  filteredMainCriteriaOptions: DropdownOption[] = [];
  filteredSubCriteriaOptions: DropdownOption[] = [];
  filteredStatusOptions: DropdownOption[] = [];

  constructor(
    private activityService: ActivityService,
    private criteriaService: CriteriaService,
    private administrationService: AdministrationService
  ) {
    this.maxDate = new Date().toISOString().split('T')[0];
    this.currentDate = new Date().toISOString();
  }

  ngOnInit() {
    this.loadAllData();
    this.initializeFilteredOptions();
    this.setupClickOutsideListener();
    this.closeAllDropdowns();
  }

  ngOnDestroy() {
    this.removeBodyOverflow();
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  }

  isAnyDropdownOpen(): boolean {
    return Object.values(this.dropdownStates).some((state) => state);
  }

  closeAllDropdowns() {
    (Object.keys(this.dropdownStates) as DropdownType[]).forEach((key) => {
      this.dropdownStates[key] = false;
    });
    this.removeBodyOverflow();
  }

  private addBodyOverflow() {
    document.body.classList.add('dropdown-open');
  }

  private removeBodyOverflow() {
    document.body.classList.remove('dropdown-open');
  }

  loadAllData() {
    this.loadUsers();
    this.loadMainCriteria();
    this.loadSubCriteria();
    this.loadAllPDFs();
  }

  loadUsers() {
    this.administrationService.getAllUsers().subscribe({
      next: (res: any) => {
        let users = [];
        if (Array.isArray(res)) {
          users = res;
        } else if (res && Array.isArray(res.users)) {
          users = res.users;
        } else if (res && Array.isArray(res.data)) {
          users = res.data;
        }

        this.userOptions = users
          .filter((user: any) => user.fullname && user.fullname.trim() !== '')
          .map((user: any) => ({
            value: user._id,
            label: user.fullname,
            selected: false,
          }));

        this.filteredUserOptions = [...this.userOptions];
      },
      error: (err: any) => {
        console.error('خطأ في تحميل المستخدمين:', err);
        this.showError('فشل في تحميل قائمة المستخدمين');
      },
    });
  }

  loadMainCriteria() {
    this.criteriaService.getAllMainCriteria().subscribe({
      next: (mainCriteria: MainCriteria[]) => {
        this.mainCriteriaOptions = (mainCriteria || []).map((criteria) => ({
          value: criteria._id,
          label: criteria.name,
          selected: false,
        }));
        this.mainCriteriaList = mainCriteria || [];
        this.filteredMainCriteriaOptions = [...this.mainCriteriaOptions];
      },
      error: (err: any) => {
        console.error('خطأ في تحميل المعايير الرئيسية:', err);
        this.showError('فشل في تحميل المعايير الرئيسية');
      },
    });
  }

  loadSubCriteria() {
    this.criteriaService.getAllSubCriteria().subscribe({
      next: (subCriteria: SubCriteria[]) => {
        this.allSubCriteria = subCriteria || [];
        this.updateSubCriteriaOptions();
      },
      error: (err: any) => {
        console.error('خطأ في تحميل المعايير الفرعية:', err);
        this.showError('فشل في تحميل المعايير الفرعية');
      },
    });
  }

  updateSubCriteriaOptions() {
    const selectedMainCriteria = this.mainCriteriaOptions
      .filter((item) => item.selected)
      .map((item) => item.value);

    if (selectedMainCriteria.length > 0) {
      this.subCriteriaOptions = this.allSubCriteria
        .filter((sub: SubCriteria) => {
          if (typeof sub.mainCriteria === 'object') {
            return selectedMainCriteria.includes((sub.mainCriteria as any)._id);
          } else {
            return selectedMainCriteria.includes(sub.mainCriteria);
          }
        })
        .map((sub) => ({
          value: sub._id,
          label: sub.name,
          selected: false,
        }));
    } else {
      this.subCriteriaOptions = [];
    }

    this.filteredSubCriteriaOptions = [...this.subCriteriaOptions];
    this.updateFilters();
  }

  updateFilters() {
    this.filters.MainCriteria = this.mainCriteriaOptions
      .filter((item) => item.selected)
      .map((item) => item.value);

    this.filters.SubCriteria = this.subCriteriaOptions
      .filter((item) => item.selected)
      .map((item) => item.value);

    this.filters.users = this.userOptions
      .filter((item) => item.selected)
      .map((item) => item.value);

    this.filters.status = this.statusOptions
      .filter((item) => item.selected)
      .map((item) => item.value);
  }

  initializeFilteredOptions() {
    this.filteredUserOptions = [...this.userOptions];
    this.filteredMainCriteriaOptions = [...this.mainCriteriaOptions];
    this.filteredSubCriteriaOptions = [...this.subCriteriaOptions];
    this.filteredStatusOptions = [...this.statusOptions];
  }

  toggleDropdown(type: DropdownType) {
    const wasOpen = this.dropdownStates[type];
    this.closeAllDropdowns();

    if (!wasOpen) {
      this.dropdownStates[type] = true;
      this.addBodyOverflow();
      this.searchTerms[type] = '';
      this.filterOptions(type);
    }
  }

  filterOptions(type: DropdownType) {
    const searchTerm = this.searchTerms[type].toLowerCase();

    switch (type) {
      case 'users':
        this.filteredUserOptions = this.userOptions.filter((option) =>
          option.label.toLowerCase().includes(searchTerm)
        );
        break;
      case 'mainCriteria':
        this.filteredMainCriteriaOptions = this.mainCriteriaOptions.filter(
          (option) => option.label.toLowerCase().includes(searchTerm)
        );
        break;
      case 'subCriteria':
        this.filteredSubCriteriaOptions = this.subCriteriaOptions.filter(
          (option) => option.label.toLowerCase().includes(searchTerm)
        );
        break;
      case 'status':
        this.filteredStatusOptions = this.statusOptions.filter((option) =>
          option.label.toLowerCase().includes(searchTerm)
        );
        break;
    }
  }

  toggleOption(type: DropdownType, option: DropdownOption) {
    option.selected = !option.selected;
    this.onFilterChange(type);
  }

  selectAll(type: DropdownType) {
    let options: DropdownOption[];

    switch (type) {
      case 'users':
        options = this.filteredUserOptions;
        break;
      case 'mainCriteria':
        options = this.filteredMainCriteriaOptions;
        break;
      case 'subCriteria':
        options = this.filteredSubCriteriaOptions;
        break;
      case 'status':
        options = this.filteredStatusOptions;
        break;
    }

    options.forEach((option) => (option.selected = true));
    this.onFilterChange(type);
  }

  clearSelection(type: DropdownType) {
    let options: DropdownOption[];

    switch (type) {
      case 'users':
        options = this.userOptions;
        break;
      case 'mainCriteria':
        options = this.mainCriteriaOptions;
        break;
      case 'subCriteria':
        options = this.subCriteriaOptions;
        break;
      case 'status':
        options = this.statusOptions;
        break;
    }

    options.forEach((option) => (option.selected = false));
    this.onFilterChange(type);
  }

  getSelectedItemsText(type: DropdownType): string {
    let options: DropdownOption[];
    let defaultText = '';

    switch (type) {
      case 'users':
        options = this.userOptions;
        defaultText = 'اختر المستخدمين...';
        break;
      case 'mainCriteria':
        options = this.mainCriteriaOptions;
        defaultText = 'اختر المعايير الرئيسية...';
        break;
      case 'subCriteria':
        options = this.subCriteriaOptions;
        defaultText = 'اختر المعايير الفرعية...';
        break;
      case 'status':
        options = this.statusOptions;
        defaultText = 'اختر الحالة...';
        break;
    }

    const selectedOptions = options.filter((option) => option.selected);

    if (selectedOptions.length === 0) {
      return defaultText;
    } else if (selectedOptions.length === 1) {
      return selectedOptions[0].label;
    } else if (selectedOptions.length === 2) {
      return `${selectedOptions[0].label}، ${selectedOptions[1].label}`;
    } else {
      return `${selectedOptions[0].label}، ${selectedOptions[1].label} +${
        selectedOptions.length - 2
      }`;
    }
  }

  setupClickOutsideListener() {
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-search-container')) {
        this.closeAllDropdowns();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isAnyDropdownOpen()) {
        this.closeAllDropdowns();
      }
    });
  }

  onMainCriteriaChange() {
    this.updateSubCriteriaOptions();
    this.filterOptions('subCriteria');
  }

  onFilterChange(type: DropdownType) {
    if (type === 'mainCriteria') {
      this.onMainCriteriaChange();
    } else {
      this.updateFilters();
    }
  }

  clearAllFilters() {
    this.userOptions.forEach((item) => (item.selected = false));
    this.mainCriteriaOptions.forEach((item) => (item.selected = false));
    this.subCriteriaOptions.forEach((item) => (item.selected = false));
    this.statusOptions.forEach((item) => (item.selected = false));

    this.filters.startDate = '';
    this.filters.endDate = '';
    this.updateFilters();
    this.showSuccess('تم مسح جميع الفلاتر بنجاح');
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  toggleReportResults(): void {
    this.showReportResults = !this.showReportResults;
    if (this.showReportResults) {
      this.scrollToElement('report-results');
    }
  }

  togglePreviousReports(): void {
    this.showPreviousReports = !this.showPreviousReports;
  }

  loadAllPDFs(): void {
    this.isLoadingPDFs = true;
    this.activityService.getAllPDFs().subscribe({
      next: (response) => {
        this.isLoadingPDFs = false;
        if (response.success) {
          this.pdfFiles = (response.pdfFiles || []).reverse();
          this.filterPDFs();
        } else {
          this.showError('فشل في تحميل التقارير السابقة');
        }
      },
      error: (error) => {
        this.isLoadingPDFs = false;
        console.error('خطأ في تحميل ملفات PDF:', error);
        this.showError('حدث خطأ أثناء تحميل التقارير السابقة');
      },
    });
  }

  normalizeNumbers(text: string): string {
    if (!text) return '';

    const arabicToEnglishMap: { [key: string]: string } = {
      '٠': '0',
      '١': '1',
      '٢': '2',
      '٣': '3',
      '٤': '4',
      '٥': '5',
      '٦': '6',
      '٧': '7',
      '٨': '8',
      '٩': '9',
    };

    return text.replace(
      /[٠١٢٣٤٥٦٧٨٩]/g,
      (char) => arabicToEnglishMap[char] || char
    );
  }

  filterPDFs(): void {
    let filtered = this.pdfFiles;

    if (this.fileTypeFilter !== 'all') {
      filtered = filtered.filter(
        (pdf) => this.getFileType(pdf) === this.fileTypeFilter
      );
    }

    if (this.searchTerm.trim()) {
      const searchTermLower = this.normalizeNumbers(this.searchTerm)
        .toLowerCase()
        .trim();

      filtered = filtered.filter((pdf) => {
        const fileName = this.normalizeNumbers(
          this.getFileName(pdf)
        ).toLowerCase();
        return fileName.includes(searchTermLower);
      });
    }

    this.filteredPDFs = filtered;
  }

  onSearchChange(): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    this.searchTimeout = setTimeout(() => {
      this.filterPDFs();
    }, 300);
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.filterPDFs();
  }

  get searchResultsInfo(): string {
    if (!this.searchTerm.trim()) {
      return `عرض ${this.filteredPDFs.length} من أصل ${this.pdfFiles.length} تقرير`;
    }

    return `عرض ${this.filteredPDFs.length} من أصل ${this.pdfFiles.length} تقرير للبحث: "${this.searchTerm}"`;
  }

  getFileType(pdf: PDFFile): 'pdf' | 'docx' {
    return this.activityService.getFileTypeFromFilename(pdf.pdfurl);
  }

  validateFilters(): boolean {
    if (!this.filters.startDate || !this.filters.endDate) {
      this.dateRequiredError = true;
      this.showError('تاريخ البداية وتاريخ النهاية مطلوبان');
      return false;
    }

    if (this.filters.startDate && this.filters.endDate) {
      const startDate = new Date(this.filters.startDate);
      const endDate = new Date(this.filters.endDate);

      if (startDate > endDate) {
        this.showDateError = true;
        this.dateRequiredError = false;
        this.showError('تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
        return false;
      }

      const today = new Date();
      if (startDate > today || endDate > today) {
        this.showDateError = true;
        this.dateRequiredError = false;
        this.showError('لا يمكن اختيار تاريخ في المستقبل');
        return false;
      }
    }

    this.showDateError = false;
    this.dateRequiredError = false;
    return true;
  }

  generateReportWithValidation() {
    this.debugFilters();

    if (!this.validateFilters()) {
      return;
    }
    this.generateReport();
  }

  generateReport() {
    this.isLoading = true;
    this.generatedReport = null;

    const cleanFilters = this.cleanFiltersBeforeSend();

    let reportObservable;

    if (this.reportType === 'pdf') {
      reportObservable =
        this.activityService.generateAllActivitiesPDF(cleanFilters);
    } else {
      reportObservable =
        this.activityService.generateAllActivitiesDOCX(cleanFilters);
    }

    reportObservable.subscribe({
      next: (response: ReportGenerationResponse) => {
        this.isLoading = false;
        this.generatedReport = {
          ...response,
          fileType: this.reportType,
        };

        if (response.success && response.file) {
          this.currentDate = new Date().toISOString();
          this.showSuccess(
            `تم إنشاء التقرير ${
              this.reportType === 'pdf' ? 'PDF' : 'DOCX'
            } بنجاح!`
          );
          this.loadAllPDFs();
          this.showReportResults = true;
          this.scrollToElement('report-results');
        } else {
          const errorMessage = response.message || 'فشل في إنشاء التقرير';
          this.showError(errorMessage);
        }
      },
      error: (error: any) => {
        this.isLoading = false;
        console.error('خطأ في إنشاء التقرير:', error);

        let errorMessage = 'حدث خطأ أثناء إنشاء التقرير';
        if (error.error && error.error.message) {
          errorMessage = error.error.message;
        } else if (error.message) {
          errorMessage = error.message;
        }

        this.generatedReport = {
          success: false,
          message: errorMessage,
        };
        this.showReportResults = true;
        this.scrollToElement('report-results');
      },
    });
  }

  cleanFiltersBeforeSend(): any {
    const cleanedFilters: any = {};

    cleanedFilters.startDate = this.filters.startDate;
    cleanedFilters.endDate = this.filters.endDate;

    if (this.filters.MainCriteria && this.filters.MainCriteria.length > 0) {
      cleanedFilters.MainCriteria = this.filters.MainCriteria.join(',');
    }

    if (this.filters.SubCriteria && this.filters.SubCriteria.length > 0) {
      cleanedFilters.SubCriteria = this.filters.SubCriteria.join(',');
    }

    if (this.filters.users && this.filters.users.length > 0) {
      cleanedFilters.user = this.filters.users.join(',');
    }

    if (this.filters.status && this.filters.status.length > 0) {
      cleanedFilters.status = this.filters.status.join(',');
    }

    console.log('الفلاتر المرسلة:', cleanedFilters);
    return cleanedFilters;
  }

  debugFilters(): void {
    console.log('=== تصحيح الفلاتر ===');
    console.log('التواريخ:', {
      startDate: this.filters.startDate,
      endDate: this.filters.endDate,
    });
    console.log(
      'المعايير الرئيسية المحددة:',
      this.mainCriteriaOptions
        .filter((item) => item.selected)
        .map((item) => item.label)
    );
    console.log(
      'المعايير الفرعية المحددة:',
      this.subCriteriaOptions
        .filter((item) => item.selected)
        .map((item) => item.label)
    );
    console.log(
      'المستخدمين المحددين:',
      this.userOptions.filter((item) => item.selected).map((item) => item.label)
    );
    console.log(
      'الحالات المحددة:',
      this.statusOptions
        .filter((item) => item.selected)
        .map((item) => item.label)
    );

    const cleaned = this.cleanFiltersBeforeSend();
    console.log('الفلاتر النهائية المرسلة:', cleaned);
  }

  viewReport(fileUrl: string, fileType: 'pdf' | 'docx') {
    try {
      if (fileType === 'pdf') {
        const filename = this.extractFilenameFromUrl(fileUrl);
        this.activityService.openPDF(filename);
      } else {
        window.open(fileUrl, '_blank');
      }
    } catch (error) {
      console.error('خطأ في فتح الملف:', error);
      this.showError('حدث خطأ أثناء فتح الملف');
    }
  }

  downloadReport(fileUrl: string, fileType: 'pdf' | 'docx') {
    try {
      if (fileType === 'pdf') {
        const filename = this.extractFilenameFromUrl(fileUrl);
        this.activityService.downloadPDF(
          filename,
          `تقرير_الأنشطة_${new Date().toISOString().split('T')[0]}.pdf`
        );
      } else {
        this.activityService.downloadDOCXFromUrl(
          fileUrl,
          `تقرير_الأنشطة_${new Date().toISOString().split('T')[0]}.docx`
        );
      }
    } catch (error) {
      console.error('خطأ في تحميل الملف:', error);
      this.showError('حدث خطأ أثناء تحميل الملف');
    }
  }

  openReport(pdfUrl: string, fileType: 'pdf' | 'docx'): void {
    try {
      if (fileType === 'pdf') {
        const filename = this.extractFilenameFromUrl(pdfUrl);
        this.activityService.openPDF(filename);
      } else {
        window.open(pdfUrl, '_blank');
      }
    } catch (error) {
      console.error('خطأ في فتح الملف:', error);
      this.showError('حدث خطأ أثناء فتح الملف');
    }
  }

  confirmDeleteReport(pdf: PDFFile): void {
    const reportName = this.getFileName(pdf);
    const reportType = this.getFileType(pdf) === 'pdf' ? 'PDF' : 'DOCX';

    Swal.fire({
      title: 'تأكيد الحذف',
      html: `
        <div class="text-center">
          <i class="fas fa-exclamation-triangle text-warning fa-3x mb-3"></i>
          <p>هل أنت متأكد من أنك تريد حذف التقرير التالي؟</p>
          <div class="alert alert-warning text-right">
            <strong>${reportName}</strong><br>
            <small>نوع الملف: ${reportType}</small>
          </div>
          <p class="text-danger">هذا الإجراء لا يمكن التراجع عنه!</p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'نعم، احذف',
      cancelButtonText: 'إلغاء',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      reverseButtons: true,
    }).then((result) => {
      if (result.isConfirmed) {
        this.deleteReport(pdf);
      }
    });
  }

  deleteReport(pdf: PDFFile): void {
    if (!pdf._id) {
      this.showError('لا يمكن حذف التقرير: معرف غير موجود');
      return;
    }

    this.activityService.deletereports(pdf._id).subscribe({
      next: (response) => {
        if (response.success) {
          this.showSuccess('تم حذف التقرير بنجاح');

          this.pdfFiles = this.pdfFiles.filter((item) => item._id !== pdf._id);
          this.filterPDFs();

          if (
            this.generatedReport &&
            this.generatedReport.file === pdf.pdfurl
          ) {
            this.generatedReport = null;
            this.showReportResults = false;
          }
        } else {
          this.showError(response.message || 'فشل في حذف التقرير');
        }
      },
      error: (error) => {
        console.error('خطأ في حذف التقرير:', error);

        let errorMessage = 'حدث خطأ أثناء حذف التقرير';
        if (error.error && error.error.message) {
          errorMessage = error.error.message;
        } else if (error.message) {
          errorMessage = error.message;
        }

        this.showError(errorMessage);
      },
    });
  }

  confirmDeleteOldReports(): void {
    const oldReports = this.getOldReports();

    if (oldReports.length === 0) {
      this.showWarning('لا توجد تقارير قديمة للحذف');
      return;
    }

    Swal.fire({
      title: 'حذف التقارير القديمة',
      html: `
        <div class="text-center">
          <i class="fas fa-trash text-danger fa-3x mb-3"></i>
          <p>هل تريد حذف جميع التقارير الأقدم من 30 يوم؟</p>
          <div class="alert alert-danger text-right">
            <strong>سيتم حذف ${oldReports.length} تقرير</strong><br>
            <small>هذا الإجراء لا يمكن التراجع عنه!</small>
          </div>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'نعم، احذف الكل',
      cancelButtonText: 'إلغاء',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      reverseButtons: true,
    }).then((result) => {
      if (result.isConfirmed) {
        this.deleteOldReports(oldReports);
      }
    });
  }

  private getOldReports(): PDFFile[] {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return this.pdfFiles.filter((pdf) => {
      const reportDate = new Date(pdf.createdAt);
      return reportDate < thirtyDaysAgo;
    });
  }

  private deleteOldReports(oldReports: PDFFile[]): void {
    let deletedCount = 0;
    let errorCount = 0;

    oldReports.forEach((pdf) => {
      if (pdf._id) {
        this.activityService.deletereports(pdf._id).subscribe({
          next: (response) => {
            if (response.success) {
              deletedCount++;
            } else {
              errorCount++;
            }
          },
          error: () => {
            errorCount++;
          },
          complete: () => {
            if (deletedCount + errorCount === oldReports.length) {
              this.loadAllPDFs();

              if (errorCount === 0) {
                this.showSuccess(`تم حذف ${deletedCount} تقرير بنجاح`);
              } else {
                this.showWarning(
                  `تم حذف ${deletedCount} تقرير، وفشل حذف ${errorCount} تقرير`
                );
              }
            }
          },
        });
      } else {
        errorCount++;
      }
    });
  }

  extractFilenameFromUrl(url: string): string {
    return this.activityService.extractFilenameFromUrl(url);
  }

  formatDate(dateString: any): string {
    // Handle null, undefined, empty string
    if (!dateString || dateString === '' || dateString === 'undefined' || dateString === 'null') {
      return 'غير محدد';
    }
    
    try {
      let date: Date;
      
      // Handle YYYY-MM-DD format (date input)
      if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString.trim())) {
        const parts = dateString.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        
        if (isNaN(year) || isNaN(month) || isNaN(day)) {
          return 'غير محدد';
        }
        
        // Create date in local timezone (no UTC offset issues)
        date = new Date(year, month, day, 12, 0, 0);
      } else {
        // Handle ISO string or other formats
        date = new Date(dateString);
      }
      
      // Validate date
      if (isNaN(date.getTime())) {
        return 'غير محدد';
      }
      
      return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (e) {
      console.error('Date formatting error:', e);
      return 'غير محدد';
    }
  }

  formatDateTime(dateString: string | undefined): string {
    if (!dateString) return '-';
    try {
      // Handle YYYY-MM-DD format
      const parts = dateString.split('-');
      let date: Date;
      
      if (parts.length === 3 && dateString.includes('-')) {
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const day = parseInt(parts[2]);
        date = new Date(year, month, day);
      } else {
        date = new Date(dateString);
      }
      
      return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString || '-';
    }
  }

  getCurrentUserName(): string {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        return user.fullname || 'المستخدم الحالي';
      } catch {
        return 'المستخدم الحالي';
      }
    }
    return 'المستخدم الحالي';
  }

  isDateComplete(): boolean {
    return !!(this.filters.startDate && this.filters.endDate);
  }

  getFilterSummary(): string {
    const parts = [];

    parts.push(`نوع: ${this.reportType === 'pdf' ? 'PDF' : 'DOCX'}`);

    if (this.filters.startDate)
      parts.push(`من: ${this.formatDate(this.filters.startDate)}`);
    if (this.filters.endDate)
      parts.push(`إلى: ${this.formatDate(this.filters.endDate)}`);

    if (this.filters.MainCriteria && this.filters.MainCriteria.length > 0) {
      const selectedNames = this.mainCriteriaOptions
        .filter((item) => item.selected)
        .map((item) => item.label);
      parts.push(`معايير رئيسية: ${selectedNames.join('، ')}`);
    }

    if (this.filters.SubCriteria && this.filters.SubCriteria.length > 0) {
      const selectedNames = this.subCriteriaOptions
        .filter((item) => item.selected)
        .map((item) => item.label);
      parts.push(`معايير فرعية: ${selectedNames.join('، ')}`);
    }

    if (this.filters.status && this.filters.status.length > 0) {
      const selectedNames = this.statusOptions
        .filter((item) => item.selected)
        .map((item) => item.label);
      parts.push(`حالات: ${selectedNames.join('، ')}`);
    }

    if (this.filters.users && this.filters.users.length > 0) {
      const selectedNames = this.userOptions
        .filter((item) => item.selected)
        .map((item) => item.label);
      parts.push(`مستخدمين: ${selectedNames.join('، ')}`);
    }

    return parts.join(' | ') || 'جميع الأنشطة في النطاق الزمني المحدد';
  }

  getFileName(pdf: PDFFile): string {
    if (!pdf.pdfurl) return 'ملف بدون اسم';

    try {
      const urlParts = pdf.pdfurl.split('/');
      let filename = urlParts[urlParts.length - 1];
      filename = filename.split('?')[0];
      filename = decodeURIComponent(filename);
      filename = filename.replace(/\.(pdf|docx)$/i, '');

      if (!filename || filename.length < 3) {
        return `تقرير_${this.formatDate(
          pdf.createdAt || new Date().toISOString()
        )}`;
      }

      return filename;
    } catch (error) {
      console.error('خطأ في استخراج اسم الملف:', error);
      return `تقرير_${this.formatDate(
        pdf.createdAt || new Date().toISOString()
      )}`;
    }
  }

  private scrollToElement(elementId: string) {
    setTimeout(() => {
      const element = document.getElementById(elementId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }

  private showSuccess(message: string) {
    Swal.fire({
      title: 'نجح!',
      text: message,
      icon: 'success',
      confirmButtonText: 'حسناً',
      confirmButtonColor: '#3085d6',
    });
  }

  private showError(message: string) {
    Swal.fire({
      title: 'خطأ!',
      text: message,
      icon: 'error',
      confirmButtonText: 'حسناً',
      confirmButtonColor: '#d33',
    });
  }

  private showWarning(message: string) {
    Swal.fire({
      title: 'تنبيه!',
      text: message,
      icon: 'warning',
      confirmButtonText: 'حسناً',
      confirmButtonColor: '#f39c12',
    });
  }

  getSelectedItemsCount(filterType: string): number {
    const options = this.getFilterOptions(filterType);
    return options.filter((option) => option.selected).length;
  }

  getFirstSelectedItemsText(filterType: string, count: number): string {
    const options = this.getFilterOptions(filterType);
    const selected = options
      .filter((option) => option.selected)
      .slice(0, count);
    return selected.map((option) => option.label).join('، ');
  }

  private getFilterOptions(filterType: string): any[] {
    switch (filterType) {
      case 'users':
        return this.userOptions;
      case 'mainCriteria':
        return this.mainCriteriaOptions;
      case 'subCriteria':
        return this.subCriteriaOptions;
      default:
        return [];
    }
  }

  getSelectedUsers() {
    return this.userOptions.filter((user) => user.selected);
  }

  getSelectedMainCriteria() {
    return this.mainCriteriaOptions.filter((criteria) => criteria.selected);
  }

  getSelectedSubCriteria() {
    return this.subCriteriaOptions.filter((sub) => sub.selected);
  }

  getTotalSelectedItems(): number {
    return (
      this.getSelectedItemsCount('users') +
      this.getSelectedItemsCount('mainCriteria') +
      this.getSelectedItemsCount('subCriteria')
    );
  }

  // ===== Current Date Display =====
  get currentDateDisplay(): string {
    const now = new Date();
    return now.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // ===== Date Presets =====
  setDatePreset(preset: string): void {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    switch (preset) {
      case 'today':
        this.filters.startDate = this.formatDateToInput(startOfToday);
        this.filters.endDate = this.formatDateToInput(today);
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        const yesterdayEnd = new Date(yesterday);
        yesterdayEnd.setHours(23, 59, 59, 999);
        this.filters.startDate = this.formatDateToInput(yesterday);
        this.filters.endDate = this.formatDateToInput(yesterdayEnd);
        break;
      case 'last7days':
        const last7Days = new Date(startOfToday);
        last7Days.setDate(last7Days.getDate() - 6);
        this.filters.startDate = this.formatDateToInput(last7Days);
        this.filters.endDate = this.formatDateToInput(today);
        break;
      case 'last30days':
        const last30Days = new Date(startOfToday);
        last30Days.setDate(last30Days.getDate() - 29);
        this.filters.startDate = this.formatDateToInput(last30Days);
        this.filters.endDate = this.formatDateToInput(today);
        break;
      case 'thisWeek':
        const dayOfWeek = startOfToday.getDay();
        const diffToSunday = dayOfWeek === 0 ? 0 : dayOfWeek;
        const sunday = new Date(startOfToday);
        sunday.setDate(sunday.getDate() - diffToSunday);
        this.filters.startDate = this.formatDateToInput(sunday);
        this.filters.endDate = this.formatDateToInput(today);
        break;
      case 'thisMonth':
        const firstOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);
        this.filters.startDate = this.formatDateToInput(firstOfMonth);
        this.filters.endDate = this.formatDateToInput(today);
        break;
      case 'lastMonth':
        const lastMonthDate = new Date(startOfToday.getFullYear(), startOfToday.getMonth() - 1, 1);
        const lastMonthEnd = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 0);
        lastMonthEnd.setHours(23, 59, 59, 999);
        this.filters.startDate = this.formatDateToInput(lastMonthDate);
        this.filters.endDate = this.formatDateToInput(lastMonthEnd);
        break;
    }
    this.dateRequiredError = false;
    this.showDateError = false;
  }

  private formatDateToInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
