//go:build wireinject

// Package wire declares the compile-time dependency graph. Run `make wire`
// (requires github.com/google/wire/cmd/wire) after changing this file to
// regenerate wire_gen.go.
package wire

import (
	"log/slog"
	"time"

	"github.com/google/wire"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/riverqueue/river"

	"checkdee-backend/internal/config"
	"checkdee-backend/internal/db"
	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/handler"
	"checkdee-backend/internal/jobs"
	"checkdee-backend/internal/lineclient"
	"checkdee-backend/internal/nagerclient"
	"checkdee-backend/internal/qrsign"
	"checkdee-backend/internal/repository"
	"checkdee-backend/internal/server"
	"checkdee-backend/internal/usecase"
)

// provideDB connects the server's own pool through the least-privilege
// checkdee_app role, not the owner/superuser DatabaseURL — see AppDatabaseURL
// on config.Config.
func provideDB(cfg *config.Config) (*pgxpool.Pool, error) {
	return db.Connect(cfg.AppDatabaseURL)
}

func provideLineClient(cfg *config.Config) *lineclient.Client {
	return lineclient.New(cfg.LineChannelID, cfg.LineChannelSecret)
}

func provideJWTIssuer(cfg *config.Config) *usecase.JWTIssuer {
	return usecase.NewJWTIssuer(cfg.JWTSecret)
}

func provideNagerClient() *nagerclient.Client {
	return nagerclient.New()
}

func provideQRSigner(cfg *config.Config) *qrsign.Signer {
	return qrsign.NewSigner(cfg.QRSigningSecret)
}

// provideReportExportRiverClient adapts the concrete river client to the
// small interface usecase.ReportExportUsecase depends on, so that package
// doesn't need to know about river's generic Client[TTx] type.
func provideReportExportRiverClient(riverClient *river.Client[pgx.Tx]) usecase.ReportExportRiverClient {
	return riverClient
}

// provideReportExportWorker wraps the report usecase's query methods as
// closures rather than the worker depending on *usecase.ReportUsecase
// directly — see ReportExportWorker's doc comment for why (avoids an
// import cycle between usecase and jobs).
func provideReportExportWorker(exports domain.ReportExportRepository, reports *usecase.ReportUsecase) *jobs.ReportExportWorker {
	return jobs.NewReportExportWorker(exports, reports.MonthlyReport, reports.DailyLog)
}

// provideRiverWorkers registers every worker this process runs.
func provideRiverWorkers(
	holidaySyncWorker *jobs.HolidaySyncWorker,
	attendanceAutoCloseWorker *jobs.AttendanceAutoCloseWorker,
	reportExportWorker *jobs.ReportExportWorker,
) *river.Workers {
	workers := jobs.Workers()
	river.AddWorker(workers, holidaySyncWorker)
	river.AddWorker(workers, attendanceAutoCloseWorker)
	river.AddWorker(workers, reportExportWorker)
	return workers
}

// providePeriodicJobs schedules holiday sync (daily, current year,
// UpsertSynced's "manual edits win" guard makes re-runs safe, RunOnStart so
// a fresh deploy doesn't wait a day) and attendance auto-close (hourly —
// cheap no-op once a day's stragglers are closed, since the underlying
// UPDATE only ever touches rows still missing a checkout). Report export has
// no periodic schedule — it's only ever triggered on demand via
// ReportExportUsecase.RequestExport.
func providePeriodicJobs() []*river.PeriodicJob {
	return []*river.PeriodicJob{
		river.NewPeriodicJob(
			river.PeriodicInterval(24*time.Hour),
			func() (river.JobArgs, *river.InsertOpts) {
				return jobs.HolidaySyncArgs{Year: time.Now().Year()}, nil
			},
			&river.PeriodicJobOpts{RunOnStart: true},
		),
		river.NewPeriodicJob(
			river.PeriodicInterval(1*time.Hour),
			func() (river.JobArgs, *river.InsertOpts) {
				return jobs.AttendanceAutoCloseArgs{}, nil
			},
			&river.PeriodicJobOpts{RunOnStart: true},
		),
	}
}

func InitializeServer(logger *slog.Logger) (*server.Server, error) {
	wire.Build(
		config.Load,
		provideDB,
		provideLineClient,
		provideJWTIssuer,
		provideNagerClient,
		provideQRSigner,
		provideReportExportRiverClient,
		provideReportExportWorker,
		provideRiverWorkers,
		providePeriodicJobs,
		jobs.NewClient,
		repository.NewUserRepository,
		repository.NewRefreshTokenRepository,
		repository.NewWorkScheduleRepository,
		repository.NewHolidayRepository,
		repository.NewKioskDeviceRepository,
		repository.NewAttendanceRepository,
		repository.NewQRNonceRepository,
		repository.NewReportRepository,
		repository.NewReportExportRepository,
		wire.Bind(new(domain.UserRepository), new(*repository.UserRepository)),
		wire.Bind(new(domain.RefreshTokenRepository), new(*repository.RefreshTokenRepository)),
		wire.Bind(new(domain.WorkScheduleRepository), new(*repository.WorkScheduleRepository)),
		wire.Bind(new(domain.HolidayRepository), new(*repository.HolidayRepository)),
		wire.Bind(new(domain.KioskDeviceRepository), new(*repository.KioskDeviceRepository)),
		wire.Bind(new(domain.AttendanceRepository), new(*repository.AttendanceRepository)),
		wire.Bind(new(domain.QRNonceRepository), new(*repository.QRNonceRepository)),
		wire.Bind(new(domain.ReportRepository), new(*repository.ReportRepository)),
		wire.Bind(new(domain.ReportExportRepository), new(*repository.ReportExportRepository)),
		wire.Bind(new(usecase.LineClient), new(*lineclient.Client)),
		wire.Bind(new(jobs.NagerClient), new(*nagerclient.Client)),
		usecase.NewAuthUsecase,
		usecase.NewScheduleUsecase,
		usecase.NewHolidayUsecase,
		usecase.NewKioskDeviceUsecase,
		usecase.NewAttendanceUsecase,
		usecase.NewReportUsecase,
		usecase.NewReportExportUsecase,
		jobs.NewHolidaySyncWorker,
		jobs.NewAttendanceAutoCloseWorker,
		handler.NewAuthHandler,
		handler.NewScheduleHandler,
		handler.NewHolidayHandler,
		handler.NewKioskHandler,
		handler.NewAttendanceHandler,
		handler.NewReportHandler,
		server.New,
	)
	return nil, nil
}
