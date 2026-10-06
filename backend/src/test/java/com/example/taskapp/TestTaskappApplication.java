package com.example.taskapp;

import org.springframework.boot.SpringApplication;

public class TestTaskappApplication {

	public static void main(String[] args) {
		SpringApplication.from(TaskappApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
