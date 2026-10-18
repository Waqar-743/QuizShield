Add-Type -AssemblyName System.Speech

$outDir = Join-Path $PSScriptRoot "audio"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$scenes = [ordered]@{
  "1" = "Online exams used to have one golden rule. Mute your mic, open a second tab, and look busy. Everyone did it. Nobody got caught."
  "2" = "So I asked a simple question. What if the platform itself was the invigilator?"
  "3" = "That question became QuizShield. A full stack quiz platform where honesty is enforced by the system, not by a teacher staring at thirty webcam feeds."
  "4" = "Logging in takes two steps. Step one, your password. Step two, your face. A live webcam frame is matched against your stored face encoding, and only then does the backend issue a real session token. No match, no dashboard. It is the only door, and there is no bypass."
  "5" = "During the quiz, the platform keeps watch. Switching tabs, losing focus, or disappearing from the camera all get logged as violations in real time. Enough violations, and the quiz submits itself."
  "6" = "Teachers build courses, draft questions with Gemini, and open a clear per student violation report before they grade a single answer."
  "7" = "QuizShield. Honesty, at the system level. An ICAT project, built by Waqar."
}

$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(
  44100,
  [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,
  [System.Speech.AudioFormat.AudioChannel]::Mono
)

foreach ($k in $scenes.Keys) {
  $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $synth.SelectVoice("Microsoft David Desktop")
  $synth.Rate = 1
  $path = Join-Path $outDir ("scene{0}.wav" -f $k)
  $synth.SetOutputToWaveFile($path, $format)
  $synth.Speak($scenes[$k])
  $synth.Dispose()
  Write-Output ("scene{0} -> {1}" -f $k, $path)
}
