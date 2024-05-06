<?php

use NodyIQ\AdvancedNovaMediaLibrary\Http\Controllers\DownloadMediaController;
use NodyIQ\AdvancedNovaMediaLibrary\Http\Controllers\MediaController;
use Illuminate\Support\Facades\Route;

Route::get('/download/{media}', [DownloadMediaController::class, 'show']);

Route::get('/media', [MediaController::class, 'index']);
