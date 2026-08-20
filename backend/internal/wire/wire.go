//go:build wireinject

// Package wire declares the compile-time dependency graph. Run `make wire`
// (requires github.com/google/wire/cmd/wire) after changing this file to
// regenerate wire_gen.go.
package wire

import (
	"log/slog"
	"time"

	"github.com/google/wire"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/riverqueue/river"

	"checkdee-backend/internal/config"
	"checkdee-backend/internal/db"
	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/handler"
	"checkdee-backend/internal/jobs"
	"checkdee-backend/internal/lineclient"
	"checkdee-backend/internal/nagerclient"
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

// provideRiverWorkers registers every worker this process runs. Holiday
// sync is the first; later PRs (attendance auto-close, leave notifications)
// add theirs here too.
func provideRiverWorkers(holidaySyncWorker *jobs.HolidaySyncWorker) *river.Workers {
	workers := jobs.Workers()
	river.AddWorker(workers, holidaySyncWorker)
	return workers
}

// providePeriodicJobs schedules holiday sync to run once a day, always for
// the current year — UpsertSynced's "manual edits win" guard makes re-runs
// safe. RunOnStart means a fresh deploy doesn't wait a full day for the
// first sync.
func providePeriodicJobs() []*river.PeriodicJob {
	return []*river.PeriodicJob{
		river.NewPeriodicJob(
			river.PeriodicInterval(24*time.Hour),
			func() (river.JobArgs, *river.InsertOpts) {
				return jobs.HolidaySyncArgs{Year: time.Now().Year()}, nil
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
		provideRiverWorkers,
		providePeriodicJobs,
		jobs.NewClient,
		repository.NewUserRepository,
		repository.NewRefreshTokenRepository,
		repository.NewWorkScheduleRepository,
		repository.NewHolidayRepository,
		wire.Bind(new(domain.UserRepository), new(*repository.UserRepository)),
		wire.Bind(new(domain.RefreshTokenRepository), new(*repository.RefreshTokenRepository)),
		wire.Bind(new(domain.WorkScheduleRepository), new(*repository.WorkScheduleRepository)),
		wire.Bind(new(domain.HolidayRepository), new(*repository.HolidayRepository)),
		wire.Bind(new(usecase.LineClient), new(*lineclient.Client)),
		wire.Bind(new(jobs.NagerClient), new(*nagerclient.Client)),
		usecase.NewAuthUsecase,
		usecase.NewScheduleUsecase,
		usecase.NewHolidayUsecase,
		jobs.NewHolidaySyncWorker,
		handler.NewAuthHandler,
		handler.NewScheduleHandler,
		handler.NewHolidayHandler,
		server.New,
	)
	return nil, nil
}
