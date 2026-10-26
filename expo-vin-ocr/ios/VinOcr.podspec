Pod::Spec.new do |s|
  s.name           = 'VinOcr'
  s.version        = '0.1.0'
  s.summary        = 'On-device VIN text recognition using Apple Vision.'
  s.description    = 'Reads text from a photo with VNRecognizeTextRequest so VIN photos never leave the device.'
  s.author         = 'Moe Qadan'
  s.homepage       = 'https://qadan.co'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '16.0' }
  s.source         = { :path => '.' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
