import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ToastrModule } from 'ngx-toastr';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LoginComponent } from './components/login/login.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { DashboardAdminComponent } from './components/dashboard-admin/dashboard-admin.component';
import { AdministrationComponent } from './components/administration/administration.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { DepartmentCriteriaManagementComponent } from './components/department-criteria-management/department-criteria-management.component';
import { AddAchievementComponent } from './components/add-achievement/add-achievement.component';
import { MyAchievementsComponent } from './components/my-achievements/my-achievements.component';
import { ArchivedActivitiesComponent } from './components/archives/archives.component';
import { DraftsComponent } from './components/draft/draft.component';
import { SocketService } from './service/socket.service';
import { NotificationService } from './service/notification.service';
import { NotificationComponent } from './components/notification/notification.component';
import { ReportsComponent } from './components/reports/reports.component';
import { QuillModule } from 'ngx-quill';

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    DashboardAdminComponent,
    AdministrationComponent,
    SidebarComponent,
    DepartmentCriteriaManagementComponent,
    AddAchievementComponent,
    MyAchievementsComponent,
    ArchivedActivitiesComponent,
    DraftsComponent,
    NotificationComponent,
    ReportsComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    BrowserAnimationsModule,
    ToastrModule.forRoot({
      positionClass: 'toast-top-right',
      timeOut: 3000,
      progressBar: true,
      closeButton: true,
      preventDuplicates: true,
    }),
      QuillModule.forRoot()
  ],
  providers: [SocketService, NotificationService],
  bootstrap: [AppComponent],
})

export class AppModule {}
