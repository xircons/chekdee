// seedowner creates the system_owner account. There's no self-registration
// path for it (it doesn't use LINE login), so it must be bootstrapped
// out-of-band. Usage:
//
//	DATABASE_URL=... go run ./cmd/seedowner -username admin -password secret
package main

import (
	"context"
	"flag"
	"fmt"
	"os"

	"golang.org/x/crypto/bcrypt"

	"checkdee-backend/internal/db"
	"checkdee-backend/internal/repository"
)

func main() {
	username := flag.String("username", "", "system_owner username")
	password := flag.String("password", "", "system_owner password")
	flag.Parse()

	if *username == "" || *password == "" {
		fmt.Fprintln(os.Stderr, "usage: seedowner -username <username> -password <password>")
		os.Exit(1)
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		fmt.Fprintln(os.Stderr, "DATABASE_URL is required")
		os.Exit(1)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(*password), bcrypt.DefaultCost)
	if err != nil {
		fmt.Fprintln(os.Stderr, "failed to hash password:", err)
		os.Exit(1)
	}

	pool, err := db.Connect(databaseURL)
	if err != nil {
		fmt.Fprintln(os.Stderr, "failed to connect to database:", err)
		os.Exit(1)
	}
	defer pool.Close()

	repo := repository.NewUserRepository(pool)
	user, err := repo.CreateSystemOwner(context.Background(), *username, string(hash))
	if err != nil {
		fmt.Fprintln(os.Stderr, "failed to create system_owner:", err)
		os.Exit(1)
	}

	fmt.Printf("created system_owner %q (id: %s)\n", *username, user.ID)
}
